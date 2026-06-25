import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  head: () => ({
    meta: [
      { title: "Iniciar sesión — Axioma" },
      { name: "description", content: "Iniciá sesión con tu mail institucional para acceder a tu aula." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/dashboard" },
        });
        if (error) throw error;
      }
      toast.success("Listo");
      navigate({ to: "/dashboard" });
    } catch (err: any) {
      toast.error(err.message ?? "Error de autenticación");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/dashboard" });
    if (result.error) {
      toast.error("No se pudo iniciar con Google");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-sans flex items-center justify-center p-6">
      <div className="w-full max-w-md border border-border bg-card p-10 animate-fade-in">
        <div className="flex items-center gap-2 mb-10">
          <div className="size-6 bg-foreground flex items-center justify-center text-[10px] font-bold text-background">Σ</div>
          <span className="font-semibold tracking-tight text-sm uppercase">Axioma</span>
        </div>

        <p className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground mb-3">
          {mode === "signin" ? "Acceso al aula" : "Crear cuenta"}
        </p>
        <h1 className="text-3xl font-bold tracking-tighter mb-8">
          {mode === "signin" ? "Iniciá sesión" : "Activá tu cuenta"}
        </h1>

        <button
          onClick={handleGoogle}
          disabled={loading}
          className="w-full mb-6 px-4 py-2.5 border border-border bg-background text-xs font-bold uppercase tracking-widest hover:bg-secondary transition-colors disabled:opacity-50"
        >
          Continuar con Google
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-px bg-border" />
          <span className="text-[10px] font-mono uppercase text-muted-foreground">o</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground block mb-2">Mail institucional</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:border-foreground transition-colors"
              placeholder="alumno@colegio.edu"
            />
          </div>
          <div>
            <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground block mb-2">Contraseña</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:border-foreground transition-colors"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-foreground text-background px-4 py-2.5 text-xs font-bold uppercase tracking-widest hover:bg-accent transition-colors disabled:opacity-50"
          >
            {loading ? "..." : mode === "signin" ? "Entrar" : "Crear cuenta"}
          </button>
        </form>

        <button
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mt-6 text-[11px] font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
        >
          {mode === "signin" ? "→ No tengo cuenta" : "→ Ya tengo cuenta"}
        </button>
      </div>
    </div>
  );
}