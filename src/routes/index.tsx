import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Axioma — Plataforma de Matemática" },
      { name: "description", content: "Plataforma editorial para aprender matemática, gestionada por el profesor del aula." },
      { property: "og:title", content: "Axioma" },
      { property: "og:description", content: "Aprendé matemática desde la plataforma. Tests, lecciones y calendario en un solo lugar." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="size-6 bg-foreground flex items-center justify-center text-[10px] font-bold text-background">Σ</div>
          <span className="font-semibold tracking-tight text-sm uppercase">Axioma</span>
        </div>
        <Link to="/auth" className="text-xs font-mono uppercase tracking-widest border border-foreground px-4 py-2 hover:bg-foreground hover:text-background transition-colors">
          Iniciar sesión
        </Link>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-24">
        <p className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground mb-6">Una plataforma. Una materia. Tu profesor.</p>
        <h1 className="text-5xl md:text-7xl font-bold tracking-tighter text-balance max-w-[18ch] mb-8">
          Aprendé matemática desde la página.
        </h1>
        <p className="text-lg text-muted-foreground max-w-prose mb-12 text-pretty">
          Axioma es la plataforma editorial donde tu profesor publica lecciones, calendario, pruebas y ejercicios. Vos resolvés, practicás y aprendés — el profe queda para las preguntas que importan.
        </p>
        <Link to="/auth" className="inline-block bg-foreground text-background px-6 py-3 text-xs font-bold uppercase tracking-widest hover:bg-accent transition-colors">
          Entrar a tu aula
        </Link>

        <div className="grid md:grid-cols-3 gap-8 mt-24 pt-12 border-t border-border">
          {[
            { k: "01", t: "Lecciones", d: "Contenido organizado por unidad. El profe escribe, vos leés y practicás." },
            { k: "02", t: "Tests adaptativos", d: "Multiple choice y completar fórmulas a partir de un gráfico." },
            { k: "03", t: "Calendario vivo", d: "Próximas pruebas, tareas pendientes y eventos de tu aula." },
          ].map((it) => (
            <div key={it.k}>
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-3">{it.k}</p>
              <h3 className="font-semibold tracking-tight mb-2">{it.t}</h3>
              <p className="text-sm text-muted-foreground text-pretty">{it.d}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
