import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/app-shell";
import { getDashboardData } from "@/lib/dashboard.functions";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({ meta: [{ title: "Calendario — Axioma" }] }),
  component: CalendarPage,
});

const labels: Record<string, string> = {
  class: "Clase",
  exam: "Prueba",
  task: "Tarea",
  other: "Evento",
};

function CalendarPage() {
  const fetchData = useServerFn(getDashboardData);
  const { data } = useQuery({ queryKey: ["dashboard"], queryFn: () => fetchData() });

  return (
    <AppShell>
      <main className="max-w-4xl mx-auto px-6 py-12 animate-fade-in">
        <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-3">Agenda</p>
        <h1 className="text-4xl font-bold tracking-tighter mb-10">Calendario del aula</h1>

        <div className="divide-y divide-border">
          {(data?.events ?? []).length === 0 && <p className="text-sm text-muted-foreground py-12 text-center">Sin eventos próximos.</p>}
          {(data?.events ?? []).map((e) => (
            <div key={e.id} className="py-5 flex items-start gap-6">
              <div className="font-mono text-xs text-muted-foreground tabular-nums w-24 shrink-0 pt-0.5">
                <div>{format(parseISO(e.starts_at as string), "dd/MM", { locale: es })}</div>
                <div className="text-[10px]">{format(parseISO(e.starts_at as string), "HH:mm")}</div>
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-mono uppercase tracking-widest text-accent mb-1">{labels[e.event_type as string] ?? "Evento"}</p>
                <h3 className="font-semibold tracking-tight">{e.title}</h3>
              </div>
            </div>
          ))}
        </div>
      </main>
    </AppShell>
  );
}