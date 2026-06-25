import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getDashboardData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase.from("profiles").select("school_id").eq("id", userId).maybeSingle();
    if (!profile?.school_id) {
      return { school_id: null, topics: [], events: [], exams: [], tasks: [], completedTaskIds: [], featuredTest: null };
    }

    const [topicsRes, examsRes, eventsRes, tasksRes, completionsRes] = await Promise.all([
      supabase.from("topics").select("id, name, slug, description, order_index").order("order_index"),
      supabase.from("exams").select("id, title, description, scheduled_at, topic_id").gte("scheduled_at", new Date(Date.now() - 86400000).toISOString()).order("scheduled_at").limit(5),
      supabase.from("calendar_events").select("id, title, event_type, starts_at, ends_at").gte("starts_at", new Date().toISOString()).order("starts_at").limit(20),
      supabase.from("tasks").select("id, title, description, due_at, topic_id").order("due_at", { ascending: true, nullsFirst: false }).limit(10),
      supabase.from("task_completions").select("task_id").eq("student_id", userId),
    ]);

    // Featured test: first test in first topic
    let featuredTest: { id: string; title: string; topic_id: string } | null = null;
    const firstTopic = topicsRes.data?.[0];
    if (firstTopic) {
      const { data } = await supabase.from("tests").select("id, title, topic_id").eq("topic_id", firstTopic.id).limit(1).maybeSingle();
      featuredTest = data;
    }

    return {
      school_id: profile.school_id,
      topics: topicsRes.data ?? [],
      events: eventsRes.data ?? [],
      exams: examsRes.data ?? [],
      tasks: tasksRes.data ?? [],
      completedTaskIds: (completionsRes.data ?? []).map((c) => c.task_id as string),
      featuredTest,
    };
  });

export const toggleTaskCompletion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { taskId: string; done: boolean }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.done) {
      await supabase.from("task_completions").upsert({ task_id: data.taskId, student_id: userId });
    } else {
      await supabase.from("task_completions").delete().eq("task_id", data.taskId).eq("student_id", userId);
    }
    return { ok: true };
  });