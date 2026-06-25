import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const getTestWithQuestions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { testId: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: test } = await supabase
      .from("tests")
      .select("id, title, description, topic_id, school_id")
      .eq("id", data.testId)
      .maybeSingle();
    if (!test) throw new Error("Test no encontrado");
    // Questions are no longer student-readable via RLS (answer keys leak).
    // Read with the service-role client and project only non-sensitive columns.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: questions } = await supabaseAdmin
      .from("questions")
      .select("id, kind, prompt, options, graph_params, order_index")
      .eq("test_id", data.testId)
      .order("order_index");
    return { test, questions: questions ?? [] };
  });

export const submitAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { testId: string; answers: { questionId: string; answer: unknown }[] }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Verify the student can actually access this test (RLS on tests still enforces same-school).
    const { data: test } = await supabase
      .from("tests")
      .select("id, school_id")
      .eq("id", data.testId)
      .maybeSingle();
    if (!test) throw new Error("Test no encontrado");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: questions } = await supabaseAdmin
      .from("questions")
      .select("id, kind, correct_answer")
      .eq("test_id", data.testId);
    if (!questions) throw new Error("No questions");

    let correct = 0;
    const graded = data.answers.map((a) => {
      const q = questions.find((x) => x.id === a.questionId);
      if (!q) return { ...a, is_correct: false };
      let ok = false;
      const ca: any = q.correct_answer;
      const ans: any = a.answer;
      if (q.kind === "multiple_choice") {
        ok = ca?.index === ans?.index;
      } else {
        ok = Number(ans?.a) === Number(ca?.a) && Number(ans?.b) === Number(ca?.b) && Number(ans?.k ?? 0) === Number(ca?.k ?? 0);
      }
      if (ok) correct++;
      return { ...a, is_correct: ok };
    });

    // Writes go through service role: students are not allowed to insert
    // attempts/answers directly (would let them fabricate scores).
    const { data: attempt, error } = await supabaseAdmin
      .from("test_attempts")
      .insert({
        test_id: data.testId,
        student_id: userId,
        total_questions: questions.length,
        correct_count: correct,
        score: questions.length ? (correct / questions.length) * 100 : 0,
        completed_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error || !attempt) throw error ?? new Error("No se pudo crear el intento");

    await supabaseAdmin.from("attempt_answers").insert(
      graded.map((g) => ({
        attempt_id: attempt.id,
        question_id: g.questionId,
        answer: g.answer as any,
        is_correct: g.is_correct,
      })),
    );

    return { correct, total: questions.length, attemptId: attempt.id };
  });

const McSchema = z.object({
  kind: z.literal("multiple_choice"),
  prompt: z.string(),
  options: z.array(z.string()).min(2).max(6),
  correct_index: z.number().int().min(0),
  explanation: z.string().optional(),
});
const GfSchema = z.object({
  kind: z.literal("graph_formula"),
  prompt: z.string(),
  a: z.number(),
  b: z.number(),
  k: z.number(),
  explanation: z.string().optional(),
});
const GenSchema = z.object({ questions: z.array(z.union([McSchema, GfSchema])).min(1).max(10) });

export const generateTestWithAI = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { topicId: string; title: string; instructions?: string; count?: number }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Falta LOVABLE_API_KEY");

    const { data: topic } = await supabase.from("topics").select("id, name, description, school_id").eq("id", data.topicId).maybeSingle();
    if (!topic) throw new Error("Tema no encontrado");

    const { generateText, Output } = await import("ai");
    const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
    const gateway = createLovableAiGatewayProvider(key);

    const count = Math.max(1, Math.min(10, data.count ?? 5));

    const system = `Sos un autor de problemas de matemática para colegio secundario. Generás problemas claros, precisos y autocontenidos en español. Para preguntas de "graph_formula" sobre función exponencial, generás los parámetros enteros pequeños (a entre -3 y 3 sin cero, b entre 2 y 5, k entre -3 y 3) y el alumno deberá completarlos viendo el gráfico.`;

    const prompt = `Tema: ${topic.name}. ${topic.description ?? ""}
Instrucciones del profesor: ${data.instructions ?? "Mezclá multiple choice y de gráfico→fórmula."}
Generá ${count} preguntas. Mezclá "multiple_choice" (4 opciones, una correcta) y "graph_formula" (para tema de función exponencial).`;

    const { output } = await generateText({
      model: gateway("google/gemini-3-flash-preview") as any,
      system,
      prompt,
      experimental_output: Output.object({ schema: GenSchema }),
    } as any);

    const generated = (output as unknown as z.infer<typeof GenSchema>).questions;

    const { data: test, error: testErr } = await supabase
      .from("tests")
      .insert({
        school_id: topic.school_id,
        topic_id: topic.id,
        title: data.title,
        description: data.instructions ?? null,
        created_by: userId,
      })
      .select("id")
      .single();
    if (testErr || !test) throw testErr ?? new Error("No se pudo crear el test");

    const rows = generated.map((q, i) => {
      if (q.kind === "multiple_choice") {
        return {
          test_id: test.id,
          kind: "multiple_choice" as const,
          prompt: q.prompt,
          options: q.options as any,
          correct_answer: { index: q.correct_index } as any,
          explanation: q.explanation ?? null,
          order_index: i,
        };
      }
      return {
        test_id: test.id,
        kind: "graph_formula" as const,
        prompt: q.prompt,
        graph_params: { a: q.a, b: q.b, k: q.k } as any,
        correct_answer: { a: q.a, b: q.b, k: q.k } as any,
        explanation: q.explanation ?? null,
        order_index: i,
      };
    });
    await supabase.from("questions").insert(rows);

    return { testId: test.id, count: rows.length };
  });