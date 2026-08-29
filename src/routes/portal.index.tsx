import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { CalendarDays, Clock, FileText, MapPin } from "lucide-react";
import { portalMe } from "@/lib/portal.functions";
import { usePortalSession } from "@/hooks/use-portal-session";
import { BRAND_NAME } from "@/config/brand";
import { dateTimeFmt, timeFmt, dateFmt, isoDate } from "@/lib/format";
import {
  PortalButton,
  PortalCard,
  PortalChip,
  PortalEmpty,
  PortalError,
  PortalLabel,
  PortalLoading,
  PortalMetric,
  PortalSection,
  PortalTile,
} from "@/components/portal-ui";
import { toast } from "sonner";

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

  if (!ready || isLoading) return <PortalLoading rows={4} />;
  if (isError)
    return (
      <PortalError
        title="Não foi possível carregar seu painel"
        description="Verifique sua conexão e tente novamente."
        action={
          <PortalButton variant="secondary" onClick={() => refetch()}>
            Tentar novamente
          </PortalButton>
        }
      />
    );
  if (!data || "error" in data) return null;

  const today = isoDate(new Date());
  const todayBlock = data.nextBlocks.find((b) => b.work_date === today) ?? null;
  const upcoming = data.nextBlocks.filter((b) => b.work_date !== today);

  const lastType = data.lastEntries[0]?.entry_type ?? null;
  const journeyDone = lastType === "saida";
  const clockedIn = lastType === "entrada" || lastType === "intervalo_retorno";
  const onBreak = lastType === "intervalo_saida";

  const punchLabel = journeyDone
    ? "Ponto registrado"
    : clockedIn || onBreak
      ? "Registrar saída"
      : "Registrar entrada";
  const statusLabel = journeyDone
    ? "Jornada concluída"
    : onBreak
      ? "Pausa em andamento"
      : clockedIn
        ? "Entrada registrada"
        : "Pronto para registrar";

  return (
    <div className="space-y-6">
      <PortalCard className="p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <PortalLabel>Seu turno de hoje</PortalLabel>
            <p className="display-type mt-1 text-2xl">
              {todayBlock ? `${timeFmt(todayBlock.start_at)} – ${timeFmt(todayBlock.end_at)}` : "Sem turno"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{dateFmt(today)}</p>
          </div>
          <PortalChip tone={journeyDone ? "acid" : clockedIn || onBreak ? "info" : "card"}>
            {statusLabel}
          </PortalChip>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="portal-tile p-3">
            <dt className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Matrícula</dt>
            <dd className="mt-1 truncate font-semibold">{data.employee.code ?? "—"}</dd>
          </div>
          <div className="portal-tile p-3">
            <dt className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Unidade</dt>
            <dd className="mt-1 truncate font-semibold">{data.unit?.name ?? "Sem unidade"}</dd>
          </div>
        </dl>

        <PortalButton block className="mt-5" disabled={journeyDone} onClick={() => navigate({ to: "/portal/ponto" })}>
          {punchLabel}
        </PortalButton>

        <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <MapPin className="size-4 shrink-0" aria-hidden />
          Seu registro pode usar a localização para confirmar se você está dentro do raio permitido da unidade.
        </p>
      </PortalCard>

      <div className="grid grid-cols-2 gap-3">
        <PortalMetric
          label="Próximo turno"
          value={upcoming[0] ? dateFmt(upcoming[0].work_date) : "—"}
          hint={upcoming[0] ? `${timeFmt(upcoming[0].start_at)} – ${timeFmt(upcoming[0].end_at)}` : "Sem publicação"}
          icon={<CalendarDays className="size-5" />}
        />
        <PortalMetric
          label="Registros recentes"
          value={data.lastEntries.length}
          hint="Últimas batidas"
          icon={<Clock className="size-5" />}
        />
      </div>

      <PortalSection
        title="Próximos turnos"
        action={
          <Link to="/portal/escala" className="text-sm font-bold underline underline-offset-4">
            Ver escala
          </Link>
        }
      >
        {data.nextBlocks.length === 0 ? (
          <PortalEmpty
            title="Nenhum turno publicado"
            description="Quando a gestão publicar sua escala, ela aparecerá aqui."
          />
        ) : (
          <ul className="space-y-3">
            {data.nextBlocks.map((b) => (
              <li key={b.id}>
                <PortalTile className="portal-press flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-bold">{dateFmt(b.work_date)}</p>
                    <p className="text-sm text-muted-foreground">
                      {timeFmt(b.start_at)} – {timeFmt(b.end_at)}
                    </p>
                  </div>
                  {b.work_date === today ? <PortalChip tone="acid">Hoje</PortalChip> : null}
                </PortalTile>
              </li>
            ))}
          </ul>
        )}
      </PortalSection>

      <PortalSection
        title="Últimos registros"
        action={
          <Link to="/portal/cartao-ponto" className="inline-flex items-center gap-1 text-sm font-bold underline underline-offset-4">
            <FileText className="size-4" aria-hidden />
            Cartão
          </Link>
        }
      >
        {data.lastEntries.length === 0 ? (
          <PortalEmpty title="Nenhuma informação disponível para este período." />
        ) : (
          <ul className="space-y-3">
            {data.lastEntries.map((e) => (
              <li key={e.id}>
                <PortalTile className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-bold capitalize">{e.entry_type.replaceAll("_", " ")}</p>
                    <p className="text-xs text-muted-foreground">{dateTimeFmt(e.server_time)}</p>
                  </div>
                  <PortalChip tone={e.geo_status === "dentro_do_raio" ? "acid" : "warn"}>
                    {e.geo_status.replaceAll("_", " ")}
                  </PortalChip>
                </PortalTile>
              </li>
            ))}
          </ul>
        )}
      </PortalSection>
    </div>
  );
}
