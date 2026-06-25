import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getTopicWithLessons = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { slug: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: topic } = await supabase
      .from("topics")
      .select("id, name, slug, description, school_id")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!topic) throw new Error("Tema no encontrado");
    const [{ data: lessons }, { data: tests }] = await Promise.all([
      supabase.from("lessons").select("id, title, content, order_index").eq("topic_id", topic.id).order("order_index"),
      supabase.from("tests").select("id, title, description").eq("topic_id", topic.id).order("created_at", { ascending: false }),
    ]);
    return { topic, lessons: lessons ?? [], tests: tests ?? [] };
  });