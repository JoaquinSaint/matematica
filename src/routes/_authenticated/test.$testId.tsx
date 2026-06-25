import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo } from "react";
import { AppShell } from "@/components/app-shell";
import { getTestWithQuestions, submitAttempt } from "@/lib/tests.functions";
import { ExponentialPlot } from "@/components/exponential-plot";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/test/$testId")({
  head: () => ({ meta: [{ title: "Test — Axioma" }] }),
  component: TestPage,
});

type Answer = { questionId: string; answer: any };

function TestPage() {
  const { testId } = Route.useParams();
  const fetchTest = useServerFn(getTestWithQuestions);
  const submit = useServerFn(submitAttempt);
  const { data, isLoading } = useQuery({ queryKey: ["test", testId], queryFn: () => fetchTest({ data: { testId } }) });

  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [result, setResult] = useState<{ correct: number; total: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const setAns = (id: string, v: any) => setAnswers((p) => ({ ...p, [id]: v }));

  const allAnswered = useMemo(() => data?.questions.every((q) => answers[q.id] !== undefined) ?? false, [data, answers]);

  async function onSubmit() {
    if (!data) return;
    setSubmitting(true);
    try {
      const payload: Answer[] = data.questions.map((q) => ({ questionId: q.id, answer: answers[q.id] }));
      const r = await submit({ data: { testId, answers: payload } });
      setResult({ correct: r.correct, total: r.total });
      toast.success(`${r.correct} / ${r.total} correctas`);
    } catch (e: any) {
      toast.error(e.message ?? "Error");
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading || !data) return <AppShell><div className="p-12 text-muted-foreground">Cargando…</div></AppShell>;

  return (
    <AppShell>
      <main className="max-w-3xl mx-auto px-6 py-12 space-y-10 animate-fade-in">
        <header>
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-3">Test</p>
          <h1 className="text-3xl font-bold tracking-tighter mb-2">{data.test.title}</h1>
          {data.test.description && <p className="text-muted-foreground text-pretty">{data.test.description}</p>}
        </header>

        {data.questions.length === 0 && <p className="text-sm text-muted-foreground">Este test todavía no tiene preguntas.</p>}

        <div className="space-y-8">
          {data.questions.map((q, i) => (
            <div key={q.id} className="border border-border p-6 bg-card">
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-4">
                Ejercicio {String(i + 1).padStart(2, "0")} — {q.kind === "multiple_choice" ? "Opción Múltiple" : "Gráfico → Fórmula"}
              </p>
              <p className="text-base font-medium leading-relaxed mb-6 text-pretty">{q.prompt}</p>

              {q.kind === "multiple_choice" && Array.isArray(q.options) && (
                <div className="space-y-2">
                  {(q.options as string[]).map((opt, idx) => {
                    const selected = answers[q.id]?.index === idx;
                    return (
                      <button
                        key={idx}
                        disabled={!!result}
                        onClick={() => setAns(q.id, { index: idx })}
                        className={`w-full text-left p-3 text-sm border transition-colors flex justify-between items-center ${selected ? "border-foreground bg-secondary" : "border-border hover:bg-secondary/50"}`}
                      >
                        <span>({String.fromCharCode(65 + idx)}) {opt}</span>
                        <span className="text-[10px] font-mono text-muted-foreground">{selected ? "[✓]" : "[ ]"}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {q.kind === "graph_formula" && q.graph_params && (
                <div className="space-y-6">
                  <div className="border border-border bg-background p-4">
                    <ExponentialPlot
                      a={(q.graph_params as any).a}
                      b={(q.graph_params as any).b}
                      k={(q.graph_params as any).k}
                      height={220}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Completá la fórmula del gráfico:</p>
                  <div className="flex items-center gap-2 font-mono text-lg flex-wrap">
                    <span>f(x) =</span>
                    {(["a", "b", "k"] as const).map((k) => (
                      <input
                        key={k}
                        type="number"
                        disabled={!!result}
                        value={answers[q.id]?.[k] ?? ""}
                        onChange={(e) => setAns(q.id, { ...answers[q.id], [k]: e.target.value === "" ? "" : Number(e.target.value) })}
                        className="w-14 border-b-2 border-foreground bg-transparent text-center focus:outline-none focus:border-accent"
                        placeholder={k}
                      />
                    ))}
                    <span className="text-xs text-muted-foreground ml-2 font-sans">(formato: a · bˣ + k)</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {!result && data.questions.length > 0 && (
          <button
            onClick={onSubmit}
            disabled={!allAnswered || submitting}
            className="w-full bg-foreground text-background px-6 py-3 text-xs font-bold uppercase tracking-widest hover:bg-accent transition-colors disabled:opacity-40"
          >
            {submitting ? "Calificando…" : "Enviar respuestas"}
          </button>
        )}

        {result && (
          <div className="border-2 border-accent p-8 text-center bg-card">
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-3">Resultado</p>
            <p className="text-5xl font-bold tracking-tighter mb-2">{result.correct} / {result.total}</p>
            <p className="text-sm text-muted-foreground">Puntaje: {Math.round((result.correct / Math.max(result.total, 1)) * 100)}%</p>
            <Link to="/dashboard" className="inline-block mt-6 text-[10px] font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground">
              ← Volver al inicio
            </Link>
          </div>
        )}
      </main>
    </AppShell>
  );
}