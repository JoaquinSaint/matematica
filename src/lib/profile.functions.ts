import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMyContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, email, full_name, school_id, year, section")
      .eq("id", userId)
      .maybeSingle();

    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);

    let school = null;
    if (profile?.school_id) {
      const { data } = await supabase.from("schools").select("id, name, slug, youtube_url, contact_email, contact_label").eq("id", profile.school_id).maybeSingle();
      school = data;
    }

    return {
      profile,
      roles: (roles ?? []).map((r) => r.role as string),
      school,
    };
  });