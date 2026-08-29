import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { portalLogin } from "@/lib/portal.functions";
import { usePortalSession } from "@/hooks/use-portal-session";
import { BRAND_NAME } from "@/config/brand";
import { maskCpf } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/portal/login")({
  head: () => ({
    meta: [
      { title: `Portal do colaborador — ${BRAND_NAME}` },
      { name: "description", content: "Acesse sua escala, seu ponto e seu cartão de ponto com CPF e PIN." },
      { property: "og:title", content: `Portal do colaborador — ${BRAND_NAME}` },
      { property: "og:description", content: "Escala, ponto e cartão de ponto do colaborador." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PortalLoginPage,
});

function PortalLoginPage() {
  const login = useServerFn(portalLogin);
  const { save } = usePortalSession();
  const navigate = useNavigate();
  const [cpf, setCpf] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const result = await login({ data: { cpf, pin } });
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      if ("token" in result && result.token) {
        save(result.token);
        navigate({ to: "/portal", replace: true });
      }
    } catch {
      toast.error("Não foi possível entrar agora.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 animate-rise">
      <div className="surface-card p-5">
        <h1 className="display-type text-2xl">Portal do colaborador</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Acesse sua escala, registre seu ponto e acompanhe sua jornada.
        </p>

        <form className="mt-6 space-y-4" onSubmit={submit}>
          <div className="space-y-1.5">
            <Label htmlFor="cpf">CPF</Label>
            <Input
              id="cpf"
              inputMode="numeric"
              autoComplete="username"
              required
              value={cpf}
              onChange={(e) => setCpf(maskCpf(e.target.value))}
              placeholder="000.000.000-00"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pin">PIN</Label>
            <Input
              id="pin"
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              required
              minLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D+/g, "").slice(0, 8))}
              placeholder="••••"
            />
          </div>
          <Button type="submit" className="h-12 w-full text-base" disabled={busy}>
            {busy ? "Entrando…" : "Entrar no portal"}
          </Button>
        </form>
      </div>

      <div className="mt-4 rounded-[12px] border-2 border-foreground bg-info p-4 text-xs">
        Precisa de ajuda? Fale com sua liderança para receber ou redefinir seu PIN. Após 5 tentativas
        incorretas o acesso é bloqueado temporariamente por segurança.
      </div>

      <a href="/" className="mt-4 inline-block text-sm font-semibold underline underline-offset-4">
        Voltar para o site
      </a>
    </div>
  );
}

