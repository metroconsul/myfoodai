import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Clock3 } from "lucide-react";
import { portalLogin } from "@/lib/portal.functions";
import { usePortalSession } from "@/hooks/use-portal-session";
import { BRAND_NAME } from "@/config/brand";
import { maskCpf } from "@/lib/format";
import { PortalButton, PortalField, PortalIconBox, portalInputClass } from "@/components/portal-ui";
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
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await login({ data: { cpf, pin } });
      if ("error" in result && result.error) {
        setError(result.error);
        toast.error(result.error);
        return;
      }
      if ("token" in result && result.token) {
        save(result.token);
        navigate({ to: "/portal", replace: true });
      }
    } catch {
      const message = "Não foi possível concluir agora. Tente novamente.";
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="animate-rise mx-auto grid w-full max-w-3xl gap-5 py-2 md:grid-cols-2 md:items-stretch">
      <aside className="hidden flex-col justify-between rounded-[32px] border-2 border-foreground bg-accent p-7 text-accent-foreground shadow-[4px_4px_0_var(--ink)] md:flex">
        <PortalIconBox tone="paper">
          <Clock3 className="size-5" />
        </PortalIconBox>
        <p className="display-type text-3xl leading-tight">Seu turno começa com clareza.</p>
        <p className="text-sm font-semibold">{BRAND_NAME}</p>
      </aside>

      <div className="rounded-[32px] border-2 border-foreground bg-card p-6 shadow-[4px_4px_0_var(--ink)]">
        <p className="display-type text-sm uppercase tracking-[0.08em]">{BRAND_NAME}</p>
        <h1 className="display-type mt-3 text-2xl">Portal do colaborador</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Acesse sua escala, registre seu ponto e acompanhe sua jornada.
        </p>

        <form className="mt-6 space-y-4" onSubmit={submit} noValidate={false}>
          <PortalField id="cpf" label="CPF">
            <input
              id="cpf"
              className={portalInputClass}
              inputMode="numeric"
              autoComplete="username"
              required
              value={cpf}
              onChange={(e) => setCpf(maskCpf(e.target.value))}
              placeholder="000.000.000-00"
              aria-invalid={!!error}
            />
          </PortalField>

          <PortalField id="pin" label="PIN">
            <input
              id="pin"
              className={portalInputClass}
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              required
              minLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D+/g, "").slice(0, 8))}
              placeholder="••••"
              aria-invalid={!!error}
            />
          </PortalField>

          {error ? (
            <p
              role="alert"
              className="rounded-[16px] border-2 border-foreground bg-warning px-4 py-3 text-sm font-semibold text-warning-foreground shadow-[2px_2px_0_var(--ink)]"
            >
              {error}
            </p>
          ) : null}

          <PortalButton type="submit" block loading={busy}>
            Entrar no portal
          </PortalButton>
        </form>

        <details className="mt-5 rounded-[16px] border-2 border-foreground bg-background p-4 text-sm shadow-[2px_2px_0_var(--ink)]">
          <summary className="cursor-pointer font-bold">Preciso de ajuda</summary>
          <p className="mt-2 text-muted-foreground">
            Fale com sua liderança para receber ou redefinir seu PIN. Após 5 tentativas incorretas o acesso
            é bloqueado temporariamente por segurança.
          </p>
        </details>

        <a href="/" className="mt-4 inline-block text-sm font-bold underline underline-offset-4">
          Voltar para o site
        </a>
      </div>
    </div>
  );
}
