import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/app-shell";
import { getDashboardData, toggleTaskCompletion } from "@/lib/dashboard.functions";
import { format, isSameDay, startOfWeek, addDays, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Inicio — Axioma" }] }),
  component: Dashboard,
});

function Dashboard() {
  const fetchData = useServerFn(getDashboardData);
  const toggle = useServerFn(toggleTaskCompletion);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: () => fetchData() });

  if (isLoading || !data) return <AppShell><div className="p-12 text-muted-foreground">Cargando…</div></AppShell>;

  if (!data.school_id) {
    return (
      <AppShell>
        <div className="max-w-2xl mx-auto px-6 py-24 text-center">
          <p className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground mb-4">Sin colegio asignado</p>
          <h1 className="text-3xl font-bold tracking-tighter mb-4">Tu cuenta todavía no está vinculada a un colegio</h1>
          <p className="text-muted-foreground">Tu profesor o administrador debe pre-cargar tu mail en el panel docente.</p>
        </div>
      </AppShell>
    );
  }

  const firstTopic = data.topics[0];
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const today = new Date();

  async function onToggle(taskId: string, done: boolean) {
    try {
      await toggle({ data: { taskId, done } });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    } catch {
      toast.error("No se pudo actualizar la tarea");
    }
  }

  return (
    <AppShell>
      <main className="max-w-7xl mx-auto px-6 py-12 grid grid-cols-12 gap-12 animate-fade-in">
        <div className="col-span-12 lg:col-span-8 space-y-12">
          {firstTopic && (
            <section>
              <header className="flex items-baseline justify-between mb-6">
                <h2 className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground">Continuar aprendiendo</h2>
                <span className="text-[10px] font-mono text-accent">● ACTIVO</span>
              </header>
              <div className="group relative border border-border p-8 hover:border-foreground/20 transition-colors bg-card">
                <div className="max-w-xl">
                  <p className="text-xs font-mono mb-2 text-muted-foreground">Tema actual</p>
                  <h1 className="text-4xl font-bold tracking-tighter text-balance mb-6">{firstTopic.name}</h1>
                  {firstTopic.description && (
                    <p className="text-muted-foreground leading-relaxed mb-8 text-pretty">{firstTopic.description}</p>
                  )}
                  <div className="flex flex-wrap gap-3">
                    <Link
                      to="/learn/$topicSlug"
                      params={{ topicSlug: firstTopic.slug }}
                      className="px-6 py-2.5 bg-foreground text-background text-xs font-bold uppercase tracking-widest hover:bg-accent transition-colors"
                    >
                      Abrir lecciones
                    </Link>
                    {data.featuredTest && (
                      <Link
                        to="/test/$testId"
                        params={{ testId: data.featuredTest.id }}
                        className="px-6 py-2.5 border border-foreground text-xs font-bold uppercase tracking-widest hover:bg-foreground hover:text-background transition-colors"
                      >
                        Practicar test
                      </Link>
                    )}
                  </div>
                </div>
                <div className="absolute top-8 right-8 text-[64px] font-bold text-border select-none hidden md:block font-mono">
                  f(x)=a<sup>x</sup>
                </div>
              </div>
            </section>
          )}

          <section>
            <h2 className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground mb-6">Temas del curso</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {data.topics.map((t) => (
                <Link
                  key={t.id}
                  to="/learn/$topicSlug"
                  params={{ topicSlug: t.slug }}
                  className="block border border-border p-6 hover:border-foreground transition-colors bg-card"
                >
                  <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">Unidad {t.order_index || "—"}</p>
                  <h3 className="font-semibold tracking-tight mb-1">{t.name}</h3>
                  {t.description && <p className="text-xs text-muted-foreground line-clamp-2 text-pretty">{t.description}</p>}
                </Link>
              ))}
              {data.topics.length === 0 && (
                <p className="text-sm text-muted-foreground col-span-2">Tu profesor todavía no publicó temas.</p>
              )}
            </div>
          </section>
        </div>

        <aside className="col-span-12 lg:col-span-4 space-y-12 animate-fade-in [animation-delay:120ms]">
          <section>
            <h2 className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground mb-6">
              {format(weekStart, "'Semana del' d 'de' MMMM", { locale: es })}
            </h2>
            <div className="grid grid-cols-7 gap-2">
              {weekDays.map((d, i) => {
                const isToday = isSameDay(d, today);
                const hasEvent = data.events.some((e) => isSameDay(parseISO(e.starts_at as string), d));
                return (
                  <div key={i} className="text-center space-y-1">
                    <span className="text-[10px] font-mono text-muted-foreground uppercase">{format(d, "EEEEE", { locale: es })}</span>
                    <div className={`h-9 flex items-center justify-center text-xs font-medium border ${isToday ? "border-accent bg-accent/5 font-bold text-foreground" : "border-border"} relative`}>
                      {format(d, "d")}
                      {hasEvent && <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 size-1 bg-accent rounded-full" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section>
            <h2 className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground mb-6">Próximas pruebas</h2>
            <div className="space-y-4">
              {data.exams.length === 0 && <p className="text-xs text-muted-foreground">Sin pruebas programadas.</p>}
              {data.exams.map((ex) => (
                <div key={ex.id} className="flex items-start gap-4">
                  <div className="font-mono text-xs pt-1 text-muted-foreground tabular-nums">{format(parseISO(ex.scheduled_at as string), "dd/MM")}</div>
                  <div>
                    <p className="text-sm font-semibold tracking-tight">{ex.title}</p>
                    {ex.description && <p className="text-xs text-muted-foreground">{ex.description}</p>}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground mb-6">Tareas pendientes</h2>
            <div className="space-y-3">
              {data.tasks.length === 0 && <p className="text-xs text-muted-foreground">Sin tareas pendientes.</p>}
              {data.tasks.map((t) => {
                const done = data.completedTaskIds.includes(t.id);
                return (
                  <label key={t.id} className="flex items-start gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={done}
                      onChange={(e) => onToggle(t.id, e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className={`mt-0.5 size-4 border flex items-center justify-center text-[8px] transition-all ${done ? "bg-foreground border-foreground text-background" : "border-border group-hover:border-foreground"}`}>
                      {done && "✓"}
                    </div>
                    <div className="flex-1">
                      <span className={`text-xs ${done ? "line-through text-muted-foreground" : "text-foreground"}`}>{t.title}</span>
                      {t.due_at && (
                        <p className="text-[10px] font-mono text-muted-foreground mt-0.5">Entrega {format(parseISO(t.due_at as string), "dd/MM HH:mm")}</p>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          </section>
        </aside>
      </main>
    </AppShell>
  );
}