import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { portalMe } from "@/lib/portal.functions";
import { usePortalSession } from "@/hooks/use-portal-session";
import { BRAND_NAME } from "@/config/brand";
import { dateTimeFmt, timeFmt, dateFmt } from "@/lib/format";
import { StatusBadge, EmptyState, LoadingState, ErrorState } from "@/components/ui-kit";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/portal/")({
  head: () => ({
    meta: [
      { title: `Meu painel — ${BRAND_NAME}` },
      { name: "description", content: "Próximos turnos, últimos registros de ponto e atalhos do colaborador." },
      { property: "og:title", content: `Meu painel — ${BRAND_NAME}` },
      { property: "og:description", content: "Resumo do colaborador: escala e ponto." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PortalHome,
});

function PortalHome() {
  const { token, ready, clear } = usePortalSession();
  const me = useServerFn(portalMe);
  const navigate = useNavigate();

  useEffect(() => {
    if (ready && !token) navigate({ to: "/portal/login", replace: true });
  }, [ready, token, navigate]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["portal-me", token],
    enabled: !!token,
    retry: 1,
    queryFn: () => me({ data: { token: token! } }),
  });

  useEffect(() => {
    if (data && "error" in data && data.error) {
      clear();
      toast.error("Sua sessão expirou. Entre novamente.");
      navigate({ to: "/portal/login", replace: true });
    }
  }, [data, navigate, clear]);

  if (!ready || isLoading) return <LoadingState rows={4} />;
  if (isError)
    return (
      <ErrorState
        title="Não foi possível carregar seu painel"
        description="Verifique sua conexão e tente novamente."
        action={
          <Button variant="secondary" onClick={() => refetch()}>
            Tentar novamente
          </Button>
        }
      />
    );
  if (!data || "error" in data) return null;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Olá,</p>
        <h1 className="text-2xl font-semibold">{data.employee.name}</h1>
        <p className="text-sm text-muted-foreground">
          {data.unit?.name ?? "Sem unidade vinculada"}
          {data.employee.code ? ` · ${data.employee.code}` : ""}
        </p>
      </div>

      <Button asChild className="w-full">
        <Link to="/portal/ponto">Registrar ponto</Link>
      </Button>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Próximos turnos
        </h2>
        {data.nextBlocks.length === 0 ? (
          <EmptyState title="Nenhum turno publicado" description="Sua escala aparecerá aqui quando publicada." />
        ) : (
          <ul className="divide-y-2 divide-foreground rounded-[12px] border-2 border-foreground bg-card overflow-hidden">
            {data.nextBlocks.map((b) => (
              <li key={b.id} className="flex items-center justify-between px-3 py-2.5 text-sm">
                <span className="font-medium">{dateFmt(b.work_date)}</span>
                <span className="text-muted-foreground">
                  {timeFmt(b.start_at)} – {timeFmt(b.end_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Últimos registros
        </h2>
        {data.lastEntries.length === 0 ? (
          <EmptyState title="Nenhum ponto registrado" />
        ) : (
          <ul className="divide-y-2 divide-foreground rounded-[12px] border-2 border-foreground bg-card overflow-hidden">
            {data.lastEntries.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-2 px-3 py-2.5 text-sm">
                <span>
                  <span className="block font-medium">{e.entry_type.replaceAll("_", " ")}</span>
                  <span className="text-xs text-muted-foreground">{dateTimeFmt(e.server_time)}</span>
                </span>
                <StatusBadge tone={e.geo_status === "dentro_do_raio" ? "ok" : "warn"}>
                  {e.geo_status.replaceAll("_", " ")}
                </StatusBadge>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
