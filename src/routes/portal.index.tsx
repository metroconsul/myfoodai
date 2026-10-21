import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { ArrowRight, Bell, Clock, FileText, PackageCheck } from "lucide-react";
import { portalMe, portalNotifications } from "@/lib/portal.functions";
import { portalPendencies } from "@/lib/portal-compliance.functions";
import { usePortalSession } from "@/hooks/use-portal-session";
import { BRAND_NAME } from "@/config/brand";
import { dateTimeFmt, isoDate } from "@/lib/format";
import type { StructuredNotification } from "@/lib/notifications.shared";
import {
  PortalButton,
  PortalCard,
  PortalChip,
  PortalError,
  PortalIconBox,
  PortalLabel,
  PortalLoading,
  PortalSection,
} from "@/components/portal-ui";
import { toast } from "sonner";

export const Route = createFileRoute("/portal/")({
  head: () => ({
    meta: [
      { title: `Hoje — ${BRAND_NAME}` },
      { name: "description", content: "Seu ponto, pendências, documentos e EPIs em um só lugar." },
      { property: "og:title", content: `Hoje — ${BRAND_NAME}` },
      { property: "og:description", content: "Resumo operacional do colaborador." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PortalHome,
});

const SHORTCUTS = [
  { to: "/portal/ponto", label: "Ponto", description: "Registrar e consultar", icon: Clock },
  { to: "/portal/documentos", label: "Documentos", description: "Arquivos e solicitações", icon: FileText },
  { to: "/portal/itens", label: "EPIs", description: "Entregas e aceites", icon: PackageCheck },
] as const;

const PRIORITY_TONE = {
  low: "card",
  normal: "info",
  high: "warn",
  urgent: "danger",
} as const;

function safeActionUrl(value: string | null) {
  return value === "/portal" || value?.startsWith("/portal/") ? value : null;
}

function PortalHome() {
  const { token, ready, clear } = usePortalSession();
  const me = useServerFn(portalMe);
  const getPendencies = useServerFn(portalPendencies);
  const getNotifications = useServerFn(portalNotifications);
  const navigate = useNavigate();

  useEffect(() => {
    if (ready && !token) void navigate({ to: "/portal/login", replace: true });
  }, [ready, token, navigate]);

  const profileQuery = useQuery({
    queryKey: ["portal-me", token],
    enabled: Boolean(token),
    retry: 1,
    queryFn: () => me({ data: { token: token! } }),
  });
  const pendenciesQuery = useQuery({
    queryKey: ["portal-pendencies", token],
    enabled: Boolean(token),
    queryFn: () => getPendencies({ data: { token: token! } }),
  });
  const notificationsQuery = useQuery({
    queryKey: ["portal-notifications", token],
    enabled: Boolean(token),
    queryFn: () => getNotifications({ data: { token: token! } }),
  });

  useEffect(() => {
    const data = profileQuery.data;
    if (data && "error" in data && data.error) {
      clear();
      toast.error("Sua sessão expirou. Entre novamente.");
      void navigate({ to: "/portal/login", replace: true });
    }
  }, [profileQuery.data, navigate, clear]);

  if (!ready || profileQuery.isLoading) return <PortalLoading rows={4} />;
  if (profileQuery.isError) {
    return (
      <PortalError
        title="Não foi possível carregar seu resumo"
        description="Verifique sua conexão e tente novamente."
        action={<PortalButton variant="secondary" onClick={() => void profileQuery.refetch()}>Tentar novamente</PortalButton>}
      />
    );
  }
  if (!profileQuery.data || "error" in profileQuery.data) return null;

  const data = profileQuery.data;
  const latestEntry = data.lastEntries[0] ?? null;
  const lastEntry = latestEntry && isoDate(new Date(latestEntry.server_time)) === isoDate(new Date()) ? latestEntry : null;
  const journeyDone = lastEntry?.entry_type === "saida";
  const clockedIn = lastEntry?.entry_type === "entrada" || lastEntry?.entry_type === "intervalo_retorno";
  const onBreak = lastEntry?.entry_type === "intervalo_saida";
  const statusLabel = journeyDone
    ? "Jornada concluída"
    : onBreak
      ? "Intervalo em andamento"
      : clockedIn
        ? "Em jornada"
        : "Aguardando entrada";

  const pendencies = pendenciesQuery.data && !("error" in pendenciesQuery.data) ? pendenciesQuery.data : null;
  const documentCount = (pendencies?.requests.length ?? 0) + (pendencies?.documents.length ?? 0);
  const epiCount = (pendencies?.deliveries.length ?? 0) + (pendencies?.exchanges.length ?? 0);
  const pointCount = pendencies?.pointCards.length ?? 0;
  const totalPendencies = documentCount + epiCount + pointCount;
  const storedNotifications =
    notificationsQuery.data && !("error" in notificationsQuery.data)
      ? notificationsQuery.data.notifications
      : [];
  const fallbackNotifications: StructuredNotification[] = [
    ...(epiCount > 0
      ? [{ id: "pending-epi", notification_type: "EPI_PENDING", title: "EPI aguardando aceite", message: "Confira a entrega e registre seu aceite.", priority: "high" as const, action_url: "/portal/itens", metadata: {}, created_at: new Date().toISOString() }]
      : []),
    ...(documentCount > 0
      ? [{ id: "pending-document", notification_type: "DOCUMENT_EXPIRING", title: "Documento pendente", message: "Há um documento esperando sua ação.", priority: "high" as const, action_url: "/portal/documentos", metadata: {}, created_at: new Date().toISOString() }]
      : []),
    ...(!journeyDone && (clockedIn || onBreak)
      ? [{ id: "clock-reminder", notification_type: "CLOCK_REMINDER", title: "Lembrete de ponto", message: "Não esqueça de registrar sua saída ao final do turno.", priority: "normal" as const, action_url: "/portal/ponto", metadata: {}, created_at: new Date().toISOString() }]
      : []),
  ];
  const notifications = storedNotifications.length > 0 ? storedNotifications : fallbackNotifications;

  return (
    <div className="space-y-7">
      <PortalCard className="overflow-hidden p-0">
        <div className="bg-accent p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <PortalLabel className="text-foreground/70">Status de ponto</PortalLabel>
              <h2 className="display-type mt-1 text-2xl">{statusLabel}</h2>
            </div>
            <PortalChip tone={journeyDone ? "acid" : clockedIn || onBreak ? "info" : "card"}>Hoje</PortalChip>
          </div>
          <p className="mt-3 text-sm font-medium text-foreground/75">
            {lastEntry ? `Última batida: ${dateTimeFmt(lastEntry.server_time)}` : "Nenhuma batida registrada hoje."}
          </p>
        </div>
        <div className="p-5">
          <PortalButton block onClick={() => void navigate({ to: "/portal/ponto" })}>
            <Clock className="size-5" aria-hidden />
            {journeyDone ? "Ver meus registros" : "Bater ponto"}
          </PortalButton>
        </div>
      </PortalCard>

      <section aria-labelledby="portal-pendencies-title" className="portal-tile p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <PortalLabel>Suas pendências</PortalLabel>
            <h2 id="portal-pendencies-title" className="display-type mt-1 text-xl">
              {totalPendencies > 0 ? `${totalPendencies} para resolver` : "Tudo em dia"}
            </h2>
          </div>
          <PortalChip tone={totalPendencies > 0 ? "warn" : "acid"}>{totalPendencies}</PortalChip>
        </div>
        {totalPendencies > 0 ? (
          <Link to="/portal/pendencias" className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-bold underline underline-offset-4">
            Ver todas as pendências <ArrowRight className="size-4" aria-hidden />
          </Link>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">Você não tem documentos, EPIs ou cartões aguardando ação.</p>
        )}
      </section>

      <PortalSection title="Recados do MyFoods">
        <div className="portal-card overflow-hidden p-0">
          <div className="flex items-center gap-4 border-b-2 border-foreground bg-foreground px-5 py-4 text-background">
            <span className="relative grid size-12 shrink-0 place-items-center rounded-[14px] border-2 border-background bg-accent text-lg font-black text-foreground" aria-hidden>
              M<span className="absolute bottom-2 left-3 size-1.5 rounded-full bg-foreground" /><span className="absolute right-3 bottom-2 size-1.5 rounded-full bg-foreground" />
            </span>
            <div>
              <p className="display-type text-base">Assistente MyFoods</p>
              <p className="mt-1 text-xs text-background/70">Lembretes automáticos da sua operação</p>
            </div>
          </div>
          {notifications.length === 0 ? (
            <div className="p-5 text-sm text-muted-foreground">Sem novos recados. Eu aviso quando algo precisar de você.</div>
          ) : (
            <ul className="divide-y-2 divide-foreground">
              {notifications.slice(0, 3).map((notification) => {
                const actionUrl = safeActionUrl(notification.action_url);
                return (
                  <li key={notification.id} className="p-5">
                    <div className="flex items-start gap-3">
                      <PortalIconBox tone="paper"><Bell className="size-5" /></PortalIconBox>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-bold">{notification.title}</p>
                          <PortalChip tone={PRIORITY_TONE[notification.priority]}>{notification.notification_type.replaceAll("_", " ")}</PortalChip>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{notification.message}</p>
                        {actionUrl ? <a href={actionUrl} className="mt-2 inline-flex items-center gap-1 text-sm font-bold underline underline-offset-4">Resolver <ArrowRight className="size-4" aria-hidden /></a> : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </PortalSection>

      <PortalSection title="Atalhos">
        <div className="grid gap-3">
          {SHORTCUTS.map((shortcut) => {
            const Icon = shortcut.icon;
            return (
              <Link key={shortcut.to} to={shortcut.to} className="portal-press portal-tile flex min-h-20 items-center gap-3 p-4">
                <PortalIconBox><Icon className="size-5" /></PortalIconBox>
                <span className="min-w-0 flex-1"><span className="block font-bold">{shortcut.label}</span><span className="block text-xs text-muted-foreground">{shortcut.description}</span></span>
                <ArrowRight className="size-5" aria-hidden />
              </Link>
            );
          })}
        </div>
      </PortalSection>
    </div>
  );
}
