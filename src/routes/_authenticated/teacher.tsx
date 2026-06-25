import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import {
  getTeacherOverview,
  createInvite,
  deleteInvite,
  createTopic,
  createLesson,
  createCalendarEvent,
  createExam,
  createTask,
  getSchoolLinks,
  updateSchoolLinks,
} from "@/lib/teacher.functions";
import { generateTestWithAI } from "@/lib/tests.functions";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";

export const Route = createFileRoute("/_authenticated/teacher")({
  head: () => ({ meta: [{ title: "Panel docente — Axioma" }] }),
  component: TeacherPanel,
});

const TABS = [
  { id: "invites", label: "Alumnos" },
  { id: "topics", label: "Temas y lecciones" },
  { id: "tests", label: "Tests" },
  { id: "calendar", label: "Calendario" },
  { id: "links", label: "Links del profe" },
] as const;
type TabId = typeof TABS[number]["id"];

function TeacherPanel() {
  const [tab, setTab] = useState<TabId>("invites");
  const fetchOv = useServerFn(getTeacherOverview);
  const { data, isLoading } = useQuery({ queryKey: ["teacher-overview"], queryFn: () => fetchOv() });

  if (isLoading || !data) return <AppShell><div className="p-12 text-muted-foreground">Cargando…</div></AppShell>;

  return (
    <AppShell>
      <main className="max-w-6xl mx-auto px-6 py-12 animate-fade-in">
        <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-3">Administración</p>
        <h1 className="text-4xl font-bold tracking-tighter mb-10">Panel docente</h1>

        <div className="flex gap-1 border-b border-border mb-10">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-[11px] font-mono uppercase tracking-widest transition-colors ${tab === t.id ? "text-foreground border-b-2 border-accent -mb-px" : "text-muted-foreground hover:text-foreground"}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "invites" && <InvitesTab data={data} />}
        {tab === "topics" && <TopicsTab data={data} />}
        {tab === "tests" && <TestsTab data={data} />}
        {tab === "calendar" && <CalendarTab data={data} />}
        {tab === "links" && <LinksTab />}
      </main>
    </AppShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border border-border p-6 bg-card">
      <h3 className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-4">{title}</h3>
      {children}
    </section>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  const { label, ...rest } = props;
  return (
    <label className="block">
      {label && <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground block mb-2">{label}</span>}
      <input
        {...rest}
        className="w-full border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:border-foreground transition-colors"
      />
    </label>
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  const { label, ...rest } = props;
  return (
    <label className="block">
      {label && <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground block mb-2">{label}</span>}
      <select {...rest} className="w-full border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:border-foreground transition-colors" />
    </label>
  );
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }) {
  const { label, ...rest } = props;
  return (
    <label className="block">
      {label && <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground block mb-2">{label}</span>}
      <textarea {...rest} className="w-full border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:border-foreground transition-colors min-h-[120px]" />
    </label>
  );
}

function PrimaryBtn({ children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...rest} className="bg-foreground text-background px-5 py-2 text-xs font-bold uppercase tracking-widest hover:bg-accent transition-colors disabled:opacity-40">
      {children}
    </button>
  );
}

/* ===== Tabs ===== */

function InvitesTab({ data }: { data: any }) {
  const qc = useQueryClient();
  const create = useServerFn(createInvite);
  const del = useServerFn(deleteInvite);
  const [form, setForm] = useState({ email: "", full_name: "", year: "", section: "", role: "student" as "student" | "teacher" });
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await create({ data: form });
      toast.success("Pre-registro creado");
      setForm({ email: "", full_name: "", year: "", section: "", role: "student" });
      qc.invalidateQueries({ queryKey: ["teacher-overview"] });
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  }

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <Section title="Pre-registrar alumno o docente">
        <form onSubmit={submit} className="space-y-3">
          <Input label="Mail" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input label="Nombre completo" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          <div className="grid grid-cols-3 gap-3">
            <Input label="Año" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} placeholder="4º" />
            <Input label="Sección" value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} placeholder="B" />
            <Select label="Rol" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as any })}>
              <option value="student">Alumno</option>
              <option value="teacher">Profesor</option>
            </Select>
          </div>
          <PrimaryBtn disabled={busy}>{busy ? "..." : "Crear"}</PrimaryBtn>
          <p className="text-[10px] font-mono text-muted-foreground mt-2">El usuario quedará asignado a tu colegio cuando inicie sesión con ese mail.</p>
        </form>
      </Section>

      <Section title={`Pre-registros (${data.invites.length})`}>
        <div className="divide-y divide-border max-h-[420px] overflow-y-auto">
          {data.invites.map((inv: any) => (
            <div key={inv.id} className="py-3 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">{inv.email}</p>
                <p className="text-[10px] font-mono text-muted-foreground uppercase">
                  {inv.role} {inv.year ? `· ${inv.year}${inv.section ?? ""}` : ""}
                </p>
              </div>
              <button
                onClick={async () => { await del({ data: { id: inv.id } }); qc.invalidateQueries({ queryKey: ["teacher-overview"] }); }}
                className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground hover:text-accent"
              >Borrar</button>
            </div>
          ))}
          {data.invites.length === 0 && <p className="text-xs text-muted-foreground py-6">Sin pre-registros.</p>}
        </div>
      </Section>
    </div>
  );
}

function TopicsTab({ data }: { data: any }) {
  const qc = useQueryClient();
  const cTopic = useServerFn(createTopic);
  const cLesson = useServerFn(createLesson);
  const [topicForm, setTopicForm] = useState({ name: "", description: "" });
  const [lessonForm, setLessonForm] = useState({ topicId: data.topics[0]?.id ?? "", title: "", content: "" });

  async function submitTopic(e: React.FormEvent) {
    e.preventDefault();
    try {
      await cTopic({ data: topicForm });
      toast.success("Tema creado");
      setTopicForm({ name: "", description: "" });
      qc.invalidateQueries({ queryKey: ["teacher-overview"] });
    } catch (e: any) { toast.error(e.message); }
  }

  async function submitLesson(e: React.FormEvent) {
    e.preventDefault();
    try {
      await cLesson({ data: lessonForm });
      toast.success("Lección publicada");
      setLessonForm({ ...lessonForm, title: "", content: "" });
    } catch (e: any) { toast.error(e.message); }
  }

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <Section title="Crear tema">
        <form onSubmit={submitTopic} className="space-y-3">
          <Input label="Nombre" required value={topicForm.name} onChange={(e) => setTopicForm({ ...topicForm, name: e.target.value })} placeholder="Función Exponencial" />
          <Textarea label="Descripción" value={topicForm.description} onChange={(e) => setTopicForm({ ...topicForm, description: e.target.value })} />
          <PrimaryBtn>Crear tema</PrimaryBtn>
        </form>

        <div className="mt-8 space-y-2">
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Temas existentes</p>
          {data.topics.map((t: any) => (
            <Link key={t.id} to="/learn/$topicSlug" params={{ topicSlug: t.slug }} className="block py-1.5 text-sm hover:text-accent">
              · {t.name}
            </Link>
          ))}
        </div>
      </Section>

      <Section title="Publicar lección">
        <form onSubmit={submitLesson} className="space-y-3">
          <Select label="Tema" required value={lessonForm.topicId} onChange={(e) => setLessonForm({ ...lessonForm, topicId: e.target.value })}>
            <option value="">— elegí un tema —</option>
            {data.topics.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select>
          <Input label="Título" required value={lessonForm.title} onChange={(e) => setLessonForm({ ...lessonForm, title: e.target.value })} />
          <Textarea label="Contenido (texto / markdown)" required value={lessonForm.content} onChange={(e) => setLessonForm({ ...lessonForm, content: e.target.value })} />
          <PrimaryBtn>Publicar</PrimaryBtn>
        </form>
      </Section>
    </div>
  );
}

function TestsTab({ data }: { data: any }) {
  const qc = useQueryClient();
  const gen = useServerFn(generateTestWithAI);
  const [form, setForm] = useState({ topicId: data.topics[0]?.id ?? "", title: "", instructions: "", count: 5 });
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await gen({ data: form });
      toast.success(`Test creado con ${r.count} preguntas`);
      qc.invalidateQueries({ queryKey: ["teacher-overview"] });
    } catch (e: any) {
      toast.error(e.message ?? "Error generando con IA");
    } finally { setBusy(false); }
  }

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <Section title="Generar test con IA">
        <form onSubmit={submit} className="space-y-3">
          <Select label="Tema" required value={form.topicId} onChange={(e) => setForm({ ...form, topicId: e.target.value })}>
            <option value="">— elegí un tema —</option>
            {data.topics.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select>
          <Input label="Título del test" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Práctica Función Exponencial" />
          <Textarea label="Instrucciones para la IA" value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} placeholder="Ej: 3 multiple choice de dominio/imagen + 2 de gráfico → fórmula con b ∈ {2, 3}" />
          <Input label="Cantidad de preguntas" type="number" min={1} max={10} value={form.count} onChange={(e) => setForm({ ...form, count: Number(e.target.value) })} />
          <PrimaryBtn disabled={busy}>{busy ? "Generando…" : "Generar test"}</PrimaryBtn>
        </form>
      </Section>

      <Section title={`Tests existentes (${data.tests.length})`}>
        <div className="divide-y divide-border max-h-[420px] overflow-y-auto">
          {data.tests.map((t: any) => (
            <Link key={t.id} to="/test/$testId" params={{ testId: t.id }} className="py-3 block hover:text-accent">
              <p className="text-sm font-medium">{t.title}</p>
              <p className="text-[10px] font-mono text-muted-foreground">{format(parseISO(t.created_at), "dd/MM/yyyy")}</p>
            </Link>
          ))}
          {data.tests.length === 0 && <p className="text-xs text-muted-foreground py-6">Sin tests todavía.</p>}
        </div>
      </Section>
    </div>
  );
}

function CalendarTab({ data }: { data: any }) {
  const qc = useQueryClient();
  const cEvent = useServerFn(createCalendarEvent);
  const cExam = useServerFn(createExam);
  const cTask = useServerFn(createTask);
  const [ev, setEv] = useState({ title: "", event_type: "class" as any, starts_at: "", description: "" });
  const [ex, setEx] = useState({ title: "", scheduled_at: "", description: "" });
  const [tk, setTk] = useState({ title: "", due_at: "", description: "" });

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <Section title="Nuevo evento">
        <form onSubmit={async (e) => { e.preventDefault(); try { await cEvent({ data: ev }); toast.success("Evento creado"); setEv({ ...ev, title: "", starts_at: "", description: "" }); qc.invalidateQueries({ queryKey: ["teacher-overview"] }); } catch (e: any) { toast.error(e.message); } }} className="space-y-3">
          <Input label="Título" required value={ev.title} onChange={(e) => setEv({ ...ev, title: e.target.value })} />
          <Select label="Tipo" value={ev.event_type} onChange={(e) => setEv({ ...ev, event_type: e.target.value as any })}>
            <option value="class">Clase</option>
            <option value="exam">Prueba</option>
            <option value="task">Tarea</option>
            <option value="other">Otro</option>
          </Select>
          <Input label="Fecha y hora" type="datetime-local" required value={ev.starts_at} onChange={(e) => setEv({ ...ev, starts_at: e.target.value })} />
          <Textarea label="Descripción" value={ev.description} onChange={(e) => setEv({ ...ev, description: e.target.value })} />
          <PrimaryBtn>Crear evento</PrimaryBtn>
        </form>
      </Section>

      <Section title="Nueva prueba/parcial">
        <form onSubmit={async (e) => { e.preventDefault(); try { await cExam({ data: ex }); toast.success("Prueba creada"); setEx({ title: "", scheduled_at: "", description: "" }); qc.invalidateQueries({ queryKey: ["teacher-overview"] }); } catch (e: any) { toast.error(e.message); } }} className="space-y-3">
          <Input label="Título" required value={ex.title} onChange={(e) => setEx({ ...ex, title: e.target.value })} />
          <Input label="Fecha y hora" type="datetime-local" required value={ex.scheduled_at} onChange={(e) => setEx({ ...ex, scheduled_at: e.target.value })} />
          <Textarea label="Temario / detalle" value={ex.description} onChange={(e) => setEx({ ...ex, description: e.target.value })} />
          <PrimaryBtn>Programar prueba</PrimaryBtn>
        </form>
      </Section>

      <Section title="Nueva tarea">
        <form onSubmit={async (e) => { e.preventDefault(); try { await cTask({ data: tk }); toast.success("Tarea creada"); setTk({ title: "", due_at: "", description: "" }); qc.invalidateQueries({ queryKey: ["teacher-overview"] }); } catch (e: any) { toast.error(e.message); } }} className="space-y-3">
          <Input label="Título" required value={tk.title} onChange={(e) => setTk({ ...tk, title: e.target.value })} />
          <Input label="Vence" type="datetime-local" value={tk.due_at} onChange={(e) => setTk({ ...tk, due_at: e.target.value })} />
          <Textarea label="Consigna" value={tk.description} onChange={(e) => setTk({ ...tk, description: e.target.value })} />
          <PrimaryBtn>Asignar tarea</PrimaryBtn>
        </form>
      </Section>
    </div>
  );
}
function LinksTab() {
  const fetchLinks = useServerFn(getSchoolLinks);
  const saveLinks = useServerFn(updateSchoolLinks);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["school-links"], queryFn: () => fetchLinks() });
  const [form, setForm] = useState({ youtube_url: "", contact_email: "", contact_label: "Contactar al profesor" });

  // Pre-fill form when data loads
  if (!isLoading && data && form.youtube_url === "" && form.contact_email === "") {
    setForm({
      youtube_url: (data as any).youtube_url ?? "",
      contact_email: (data as any).contact_email ?? "",
      contact_label: (data as any).contact_label ?? "Contactar al profesor",
    });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    try {
      await saveLinks({ data: form });
      toast.success("Links guardados");
      qc.invalidateQueries({ queryKey: ["school-links"] });
      qc.invalidateQueries({ queryKey: ["my-context"] });
    } catch (err: any) {
      toast.error(err.message ?? "Error al guardar");
    }
  }

  if (isLoading) return <p className="text-sm text-muted-foreground">Cargando…</p>;

  return (
    <div className="max-w-lg space-y-6">
      <Section title="Links visibles para los alumnos">
        <form onSubmit={handleSave} className="space-y-4">
          <Input
            label="URL de tu canal de YouTube"
            type="url"
            placeholder="https://youtube.com/@tu-canal"
            value={form.youtube_url}
            onChange={(e) => setForm({ ...form, youtube_url: e.target.value })}
          />
          <Input
            label="Gmail / email de contacto"
            type="email"
            placeholder="profe@gmail.com"
            value={form.contact_email}
            onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
          />
          <Input
            label='Etiqueta del botón de contacto (ej: "Escribirle al profe")'
            value={form.contact_label}
            onChange={(e) => setForm({ ...form, contact_label: e.target.value })}
          />
          <p className="text-[11px] text-muted-foreground font-mono">
            Estos links aparecen en la barra de navegación de todos los alumnos del colegio.
            Dejá en blanco los que no querés mostrar.
          </p>
          <PrimaryBtn type="submit">Guardar links</PrimaryBtn>
        </form>
      </Section>
    </div>
  );
}
