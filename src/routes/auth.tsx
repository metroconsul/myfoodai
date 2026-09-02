import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { BRAND_NAME } from "@/config/brand";
import { resumePendingCheckout } from "@/lib/pending-checkout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: `Entrar — ${BRAND_NAME}` },
      { name: "description", content: "Acesse o painel de gestão de pessoas, escalas, ponto e estoque." },
      { property: "og:title", content: `Entrar — ${BRAND_NAME}` },
      { property: "og:description", content: "Acesso ao painel administrativo." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) return;
      if (await continueAfterAuth(data.session.user.id)) return;
      navigate({ to: "/app", replace: true });
    });
  }, [navigate]);

  /** Usuário sem empresa passa pelo onboarding antes do checkout pendente. */
  async function continueAfterAuth(userId: string): Promise<boolean> {
    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", userId)
      .maybeSingle();
    if (!profile?.company_id) {
      navigate({ to: "/app", replace: true }); // o gate leva ao onboarding
      return true;
    }
    return resumePendingCheckout();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/app`,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        toast.success("Conta criada. Você já pode entrar.");
        setMode("login");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (await resumePendingCheckout()) return;
        navigate({ to: "/app", replace: true });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível continuar.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Não foi possível entrar com o Google.");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/app", replace: true });
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md surface-card p-7 animate-rise">
          <Link to="/" className="mb-6 inline-flex items-center gap-2 text-sm font-medium hover:underline">
            ← Voltar
          </Link>
          <p className="display-type text-xs uppercase tracking-tight">{BRAND_NAME}</p>
          <h1 className="display-type mt-3 text-2xl">
            {mode === "login" ? "Entrar no painel" : "Criar conta"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Gestão de pessoas, escalas, ponto, estoque e vendas.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {mode === "signup" ? (
              <div className="space-y-1.5">
                <Label htmlFor="fullName">Nome completo</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  maxLength={120}
                  required
                />
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={255}
                required
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="password">Senha</Label>
                {mode === "login" ? (
                  <button
                    type="button"
                    className="text-xs font-medium underline-offset-4 hover:underline"
                    onClick={() =>
                      toast.info("Fale com o administrador da conta para redefinir sua senha.")
                    }
                  >
                    Esqueci minha senha
                  </button>
                ) : null}
              </div>
              <Input
                id="password"
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                maxLength={72}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Aguarde…" : mode === "login" ? "Entrar" : "Criar conta"}
            </Button>
          </form>

          <div className="my-5 flex items-center gap-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            <span className="h-0.5 flex-1 bg-foreground" /> ou <span className="h-0.5 flex-1 bg-foreground" />
          </div>

          <Button variant="outline" className="w-full" onClick={handleGoogle}>
            Continuar com Google
          </Button>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "login" ? "Ainda não tem conta?" : "Já tem conta?"}{" "}
            <button
              type="button"
              className="font-semibold text-foreground underline underline-offset-4"
              onClick={() => setMode(mode === "login" ? "signup" : "login")}
            >
              {mode === "login" ? "Criar agora" : "Entrar"}
            </button>
          </p>
        </div>
      </div>

      <aside className="hidden border-l-2 border-foreground bg-accent p-12 lg:flex lg:flex-col lg:justify-between">
        <p className="display-type text-sm uppercase">{BRAND_NAME}</p>
        <p className="display-type max-w-md text-4xl leading-[1.05]">
          Gestão de pessoas, escalas, ponto, estoque e vendas.
        </p>
        <div className="flex flex-wrap gap-2">
          {["Escalas", "Ponto auditável", "Estoque visual", "Multiunidade"].map((tag) => (
            <span
              key={tag}
              className="rounded-[8px] border-2 border-foreground bg-card px-3 py-1 text-xs font-semibold shadow-[2px_2px_0_var(--ink)]"
            >
              {tag}
            </span>
          ))}
        </div>
      </aside>
    </div>
  );
}

