import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertTeacher(supabase: any, userId: string) {
  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const ok = (roles ?? []).some((r: any) => r.role === "teacher" || r.role === "super_admin");
  if (!ok) throw new Error("Solo profesores pueden hacer esto");
}

async function getSchoolId(supabase: any, userId: string) {
  const { data } = await supabase.from("profiles").select("school_id").eq("id", userId).maybeSingle();
  if (!data?.school_id) throw new Error("Tu cuenta no tiene colegio asignado");
  return data.school_id as string;
}

export const getTeacherOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertTeacher(supabase, userId);
    const schoolId = await getSchoolId(supabase, userId);

    const [invites, topics, subjects, events, tests, exams, tasks] = await Promise.all([
      supabase.from("school_invites").select("id, email, role, full_name, year, section").eq("school_id", schoolId).order("created_at", { ascending: false }),
      supabase.from("topics").select("id, name, slug, order_index, subject_id").eq("school_id", schoolId).order("order_index"),
      supabase.from("subjects").select("id, name").eq("school_id", schoolId),
      supabase.from("calendar_events").select("id, title, event_type, starts_at").eq("school_id", schoolId).order("starts_at", { ascending: false }).limit(20),
      supabase.from("tests").select("id, title, topic_id, created_at").eq("school_id", schoolId).order("created_at", { ascending: false }).limit(20),
      supabase.from("exams").select("id, title, scheduled_at").eq("school_id", schoolId).order("scheduled_at", { ascending: false }).limit(10),
      supabase.from("tasks").select("id, title, due_at").eq("school_id", schoolId).order("due_at", { ascending: false }).limit(10),
    ]);

    return {
      schoolId,
      invites: invites.data ?? [],
      topics: topics.data ?? [],
      subjects: subjects.data ?? [],
      events: events.data ?? [],
      tests: tests.data ?? [],
      exams: exams.data ?? [],
      tasks: tasks.data ?? [],
    };
  });

export const createInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { email: string; role: "student" | "teacher"; full_name?: string; year?: string; section?: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertTeacher(supabase, userId);
    const schoolId = await getSchoolId(supabase, userId);
    const { error } = await supabase.from("school_invites").upsert(
      { email: data.email.toLowerCase(), role: data.role, full_name: data.full_name, year: data.year, section: data.section, school_id: schoolId },
      { onConflict: "email" },
    );
    if (error) throw error;
    return { ok: true };
  });

export const deleteInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    await supabase.from("school_invites").delete().eq("id", data.id);
    return { ok: true };
  });

function slugify(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export const createTopic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { name: string; description?: string; subjectId?: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertTeacher(supabase, userId);
    const schoolId = await getSchoolId(supabase, userId);

    let subjectId = data.subjectId;
    if (!subjectId) {
      const { data: s } = await supabase.from("subjects").select("id").eq("school_id", schoolId).limit(1).maybeSingle();
      if (s) subjectId = s.id as string;
      else {
        const { data: ns } = await supabase.from("subjects").insert({ school_id: schoolId, name: "Matemática" }).select("id").single();
        subjectId = ns!.id as string;
      }
    }

    const { error } = await supabase.from("topics").insert({
      school_id: schoolId,
      subject_id: subjectId,
      name: data.name,
      slug: slugify(data.name),
      description: data.description ?? null,
    });
    if (error) throw error;
    return { ok: true };
  });

export const createLesson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { topicId: string; title: string; content: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertTeacher(supabase, userId);
    const schoolId = await getSchoolId(supabase, userId);
    const { error } = await supabase.from("lessons").insert({
      topic_id: data.topicId,
      school_id: schoolId,
      title: data.title,
      content: data.content,
      created_by: userId,
    });
    if (error) throw error;
    return { ok: true };
  });

export const createCalendarEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { title: string; event_type: "class" | "exam" | "task" | "other"; starts_at: string; description?: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertTeacher(supabase, userId);
    const schoolId = await getSchoolId(supabase, userId);
    const { error } = await supabase.from("calendar_events").insert({
      school_id: schoolId,
      title: data.title,
      event_type: data.event_type,
      starts_at: data.starts_at,
      description: data.description ?? null,
      created_by: userId,
    });
    if (error) throw error;
    return { ok: true };
  });

export const createExam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { title: string; scheduled_at: string; description?: string; topicId?: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertTeacher(supabase, userId);
    const schoolId = await getSchoolId(supabase, userId);
    const { error } = await supabase.from("exams").insert({
      school_id: schoolId,
      title: data.title,
      scheduled_at: data.scheduled_at,
      description: data.description ?? null,
      topic_id: data.topicId ?? null,
      created_by: userId,
    });
    if (error) throw error;
    return { ok: true };
  });

export const createTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { title: string; due_at?: string; description?: string; topicId?: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertTeacher(supabase, userId);
    const schoolId = await getSchoolId(supabase, userId);
    const { error } = await supabase.from("tasks").insert({
      school_id: schoolId,
      title: data.title,
      due_at: data.due_at ?? null,
      description: data.description ?? null,
      topic_id: data.topicId ?? null,
      created_by: userId,
    });
    if (error) throw error;
    return { ok: true };
  });
export const getSchoolLinks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertTeacher(supabase, userId);
    const schoolId = await getSchoolId(supabase, userId);
    const { data } = await supabase
      .from("schools")
      .select("youtube_url, contact_email, contact_label")
      .eq("id", schoolId)
      .maybeSingle();
    return data ?? { youtube_url: null, contact_email: null, contact_label: null };
  });

export const updateSchoolLinks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { youtube_url?: string; contact_email?: string; contact_label?: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertTeacher(supabase, userId);
    const schoolId = await getSchoolId(supabase, userId);
    const { error } = await supabase
      .from("schools")
      .update({
        youtube_url: data.youtube_url ?? null,
        contact_email: data.contact_email ?? null,
        contact_label: data.contact_label ?? "Contactar al profesor",
      })
      .eq("id", schoolId);
    if (error) throw error;
    return { ok: true };
  });
