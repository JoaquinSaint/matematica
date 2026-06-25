import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyContext } from "@/lib/profile.functions";
import { getSchoolLinks } from "@/lib/teacher.functions";
import { useEffect, useMemo, useState } from "react";

// SVG icons inline (no extra deps)
function YoutubeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-4">
      <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31.6 31.6 0 0 0 0 12a31.6 31.6 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31.6 31.6 0 0 0 24 12a31.6 31.6 0 0 0-.5-5.8ZM9.8 15.5V8.5l6.3 3.5-6.3 3.5Z"/>
    </svg>
  );
}

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4">
      <rect x="2" y="4" width="20" height="16" rx="2"/>
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
    </svg>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const fetchCtx = useServerFn(getMyContext);
  const fetchLinks = useServerFn(getSchoolLinks);
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setHasSession(!!data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setHasSession(!!session);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);
  const { data } = useQuery({
    queryKey: ["my-context"],
    queryFn: () => fetchCtx(),
    enabled: hasSession === true,
    retry: false,
  });
  const isTeacherForLinks = data?.roles?.some((r: string) => r === "teacher" || r === "super_admin") ?? false;
  const { data: schoolLinks } = useQuery({
    queryKey: ["school-links"],
    queryFn: () => fetchLinks(),
    enabled: hasSession === true && isTeacherForLinks,
    retry: false,
  });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const initials = useMemo(() => {
    const n = data?.profile?.full_name || data?.profile?.email || "";
    return n.split(/\s+|@/).slice(0, 2).map((s: string) => s[0]?.toUpperCase() ?? "").join("");
  }, [data]);

  const isTeacher = isTeacherForLinks;

  // School links: teacher sees their own school's links via the query above.
  // Students get links from their profile school (fetched via getMyContext → school).
  // We merge: prefer schoolLinks (teacher), fall back to data.school for students.
  const ytUrl = (schoolLinks as any)?.youtube_url ?? (data?.school as any)?.youtube_url ?? null;
  const contactEmail = (schoolLinks as any)?.contact_email ?? (data?.school as any)?.contact_email ?? null;
  const contactLabel = (schoolLinks as any)?.contact_label ?? (data?.school as any)?.contact_label ?? "Contactar al profesor";

  async function handleSignOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const navItem = (to: string, label: string) => {
    const active = pathname === to || pathname.startsWith(to + "/");
    return (
      <Link
        to={to}
        className={`text-[11px] font-mono uppercase tracking-widest px-3 py-1.5 transition-colors ${active ? "text-foreground border-b-2 border-accent" : "text-muted-foreground hover:text-foreground"}`}
      >
        {label}
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="size-6 bg-foreground flex items-center justify-center text-[10px] font-bold text-background">Σ</div>
            <span className="font-semibold tracking-tight text-sm uppercase">Axioma</span>
          </Link>
          <div className="h-4 w-px bg-border" />
          <span className="text-xs font-mono text-muted-foreground uppercase tracking-widest hidden md:inline">
            {data?.school?.name ?? "Cargando…"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {navItem("/dashboard", "Inicio")}
          {navItem("/calendar", "Calendario")}
          {isTeacher && navItem("/teacher", "Panel docente")}
          {ytUrl && (
            <a
              href={ytUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Canal de YouTube del profesor"
              className="ml-1 px-2 py-1.5 text-[#FF0000] hover:bg-[#FF0000]/10 transition-colors rounded flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-widest"
            >
              <YoutubeIcon />
              <span className="hidden lg:inline">YouTube</span>
            </a>
          )}
          {contactEmail && (
            <a
              href={`mailto:${contactEmail}`}
              title={contactLabel}
              className="px-2 py-1.5 text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-widest"
            >
              <MailIcon />
              <span className="hidden lg:inline">{contactLabel}</span>
            </a>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-medium leading-tight">{data?.profile?.full_name || data?.profile?.email}</p>
            <p className="text-[10px] font-mono text-muted-foreground uppercase">
              {isTeacher ? "Docente" : data?.profile?.year ? `${data.profile.year}${data.profile.section ? " " + data.profile.section : ""}` : "Alumno"}
            </p>
          </div>
          <div className="size-8 bg-secondary text-foreground rounded-full flex items-center justify-center text-[10px] font-bold">
            {initials || "?"}
          </div>
          <button
            onClick={handleSignOut}
            className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground hover:text-accent transition-colors"
          >
            Salir
          </button>
        </div>
      </nav>
      {children}
    </div>
  );
}