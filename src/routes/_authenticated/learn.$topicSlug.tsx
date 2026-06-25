import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { getTopicWithLessons } from "@/lib/learn.functions";
import { ExponentialPlot } from "@/components/exponential-plot";

export const Route = createFileRoute("/_authenticated/learn/$topicSlug")({
  head: () => ({ meta: [{ title: "Lección — Axioma" }] }),
  component: LearnPage,
});

function LearnPage() {
  const { topicSlug } = Route.useParams();
  const fetchTopic = useServerFn(getTopicWithLessons);
  const { data, isLoading } = useQuery({
    queryKey: ["topic", topicSlug],
    queryFn: () => fetchTopic({ data: { slug: topicSlug } }),
  });
  const [selectedIdx, setSelectedIdx] = useState(0);

  if (isLoading || !data) return <AppShell><div className="p-12 text-muted-foreground">Cargando…</div></AppShell>;
  const lesson = data.lessons[selectedIdx];
  const isExponential = data.topic.slug.includes("exponencial");

  return (
    <AppShell>
      <main className="max-w-7xl mx-auto px-6 py-12 grid grid-cols-12 gap-10 animate-fade-in">
        <aside className="col-span-12 lg:col-span-3 space-y-6">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">Tema</p>
            <h1 className="text-2xl font-bold tracking-tighter">{data.topic.name}</h1>
            {data.topic.description && <p className="text-xs text-muted-foreground mt-3 text-pretty">{data.topic.description}</p>}
          </div>
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-3">Lecciones</p>
            <ol className="space-y-1">
              {data.lessons.map((l, i) => (
                <li key={l.id}>
                  <button
                    onClick={() => setSelectedIdx(i)}
                    className={`w-full text-left px-3 py-2 text-xs border-l-2 transition-colors ${i === selectedIdx ? "border-accent bg-secondary text-foreground" : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"}`}
                  >
                    <span className="font-mono text-[10px] mr-2">{String(i + 1).padStart(2, "0")}</span>
                    {l.title}
                  </button>
                </li>
              ))}
              {data.lessons.length === 0 && <li className="text-xs text-muted-foreground px-3">Sin lecciones aún.</li>}
            </ol>
          </div>
          {data.tests.length > 0 && (
            <div>
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-3">Tests disponibles</p>
              <div className="space-y-2">
                {data.tests.map((t) => (
                  <Link
                    key={t.id}
                    to="/test/$testId"
                    params={{ testId: t.id }}
                    className="block px-3 py-2 text-xs border border-border hover:border-foreground transition-colors"
                  >
                    <span className="font-medium">{t.title}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </aside>

        <article className="col-span-12 lg:col-span-9 space-y-8">
          {lesson ? (
            <>
              <header>
                <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-3">
                  Lección {String(selectedIdx + 1).padStart(2, "0")}
                </p>
                <h2 className="text-4xl font-bold tracking-tighter text-balance mb-2">{lesson.title}</h2>
              </header>
              <div className="prose prose-slate max-w-none whitespace-pre-wrap font-sans text-foreground leading-relaxed text-[15px]">
                {lesson.content}
              </div>
              {isExponential && (
                <div className="border border-border p-6 bg-card">
                  <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-4">Visualización interactiva</p>
                  <h3 className="font-semibold tracking-tight mb-4">f(x) = 1 · 2ˣ</h3>
                  <ExponentialPlot a={1} b={2} k={0} />
                </div>
              )}
            </>
          ) : (
            <div className="text-muted-foreground text-sm">Tu profesor todavía no publicó lecciones para este tema.</div>
          )}
        </article>
      </main>
    </AppShell>
  );
}