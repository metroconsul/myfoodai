import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileText, ChevronRight } from "lucide-react";
import { BRAND_NAME } from "@/config/brand";
import { usePortalSession } from "@/hooks/use-portal-session";
import { portalMyPayslips } from "@/lib/portal-payslips.functions";
import {
  PortalCard,
  PortalChip,
  PortalEmpty,
  PortalError,
  PortalIconBox,
  PortalLabel,
  PortalLoading,
  PortalSection,
} from "@/components/portal-ui";
import { dateFmt } from "@/lib/format";
import {
  PAYSLIP_STATUS_LABEL,
  PENDING_STATUSES,
  competenceLabel,
  type PayslipStatus,
} from "@/lib/payslips.shared";

export const Route = createFileRoute("/portal/holerites/")({
  head: () => ({
    meta: [
      { title: `Meus holerites — ${BRAND_NAME}` },
      { name: "description", content: "Consulte, confira e assine seus holerites pelo portal." },
      { property: "og:title", content: `Meus holerites — ${BRAND_NAME}` },
      { property: "og:description", content: "Holerites disponíveis para conferência e assinatura." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PortalPayslips,
});

const chipTone = (status: string) =>
  status === "signed" ? "acid" : status === "dispute_open" ? "danger" : status === "expired" ? "warn" : "card";

function PortalPayslips() {
  const { token, ready } = usePortalSession();
  const list = useServerFn(portalMyPayslips);

  const query = useQuery({
    queryKey: ["portal-payslips", token],
    enabled: !!token,
    queryFn: () => list({ data: { token: token! } }),
  });

  if (!ready) return <PortalLoading label="Carregando…" />;
  if (!token)
    return (
      <PortalError
        title="Sessão encerrada"
        description="Entre novamente com seu CPF e PIN para ver seus holerites."
      />
    );
  if (query.isLoading) return <PortalLoading rows={4} label="Buscando holerites…" />;
  if (query.isError || (query.data && "error" in query.data))
    return (
      <PortalError
        title="Não foi possível carregar"
        description="Verifique sua conexão e tente novamente."
      />
    );

  const payslips = query.data && "payslips" in query.data ? query.data.payslips : [];
  const pending = payslips.filter((p) => PENDING_STATUSES.includes(p.status as PayslipStatus));

  return (
    <div className="space-y-6">
      <PortalSection title="Meus holerites">
        {pending.length ? (
          <PortalCard className="bg-accent p-4">
            <p className="display-type text-base">
              {pending.length === 1
                ? "1 documento aguarda sua conferência"
                : `${pending.length} documentos aguardam sua conferência`}
            </p>
            <p className="mt-1 text-xs">Abra, confira os dados e registre seu aceite.</p>
          </PortalCard>
        ) : null}

        {payslips.length === 0 ? (
          <PortalEmpty
            title="Nenhum holerite disponível"
            description="Assim que o RH publicar um documento, ele aparece aqui."
          />
        ) : (
          <ul className="space-y-3">
            {payslips.map((p) => (
              <li key={p.id}>
                <Link
                  to="/portal/holerites/$id"
                  params={{ id: p.id }}
                  className="portal-press block rounded-[24px] border-2 border-foreground bg-card p-4 shadow-[4px_4px_0_var(--ink)]"
                >
                  <div className="flex items-center gap-3">
                    <PortalIconBox>
                      <FileText className="size-5" />
                    </PortalIconBox>
                    <div className="min-w-0 flex-1">
                      <PortalLabel>Competência</PortalLabel>
                      <p className="display-type truncate text-lg">
                        {competenceLabel(p.payroll_period)}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {p.reference_label ?? "Holerite mensal"}
                        {p.due_at ? ` · prazo ${dateFmt(p.due_at)}` : ""}
                      </p>
                    </div>
                    <ChevronRight className="size-5 shrink-0" aria-hidden />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <PortalChip tone={chipTone(p.status)}>
                      {PAYSLIP_STATUS_LABEL[p.status] ?? p.status}
                    </PortalChip>
                    {p.current_version > 1 ? (
                      <PortalChip tone="info">Versão {p.current_version}</PortalChip>
                    ) : null}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PortalSection>
    </div>
  );
}
