import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Printer } from "lucide-react";
import { BRAND_NAME } from "@/config/brand";
import { usePortalSession } from "@/hooks/use-portal-session";
import { portalPayslipReceipt } from "@/lib/portal-payslips.functions";
import {
  PortalButton,
  PortalCard,
  PortalError,
  PortalLabel,
  PortalLoading,
  PortalSection,
} from "@/components/portal-ui";
import { LgpdConsentSummary } from "@/components/lgpd-consent";
import { dateTimeFmt } from "@/lib/format";
import {
  AUDIT_EVENT_LABEL,
  FACE_STATE_LABEL,
  LOCATION_STATE_LABEL,
  competenceLabel,
  shortHash,
} from "@/lib/payslips.shared";

export const Route = createFileRoute("/portal/holerites/$id/comprovante")({
  head: () => ({
    meta: [
      { title: `Comprovante de aceite — ${BRAND_NAME}` },
      { name: "description", content: "Comprovante auditável do aceite eletrônico do holerite." },
      { property: "og:title", content: `Comprovante de aceite — ${BRAND_NAME}` },
      { property: "og:description", content: "Evidências e trilha de auditoria do aceite." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Receipt,
});

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-0.5 border-b-2 border-dashed border-foreground/20 py-2 last:border-0">
      <PortalLabel>{label}</PortalLabel>
      <p className="break-words text-sm">{value}</p>
    </div>
  );
}

function Receipt() {
  const { id } = useParams({ from: "/portal/holerites/$id/comprovante" });
  const { token, ready } = usePortalSession();
  const receiptFn = useServerFn(portalPayslipReceipt);

  const query = useQuery({
    queryKey: ["portal-payslip-receipt", id, token],
    enabled: !!token,
    queryFn: () => receiptFn({ data: { token: token!, payslipId: id } }),
  });

  if (!ready) return <PortalLoading label="Carregando…" />;
  if (!token) return <PortalError title="Sessão encerrada" description="Entre novamente no portal." />;
  if (query.isLoading) return <PortalLoading rows={5} label="Montando comprovante…" />;
  const data = query.data && !("error" in query.data) ? query.data : null;
  if (query.isError || !data)
    return <PortalError title="Comprovante indisponível" description="Tente novamente mais tarde." />;

  const s = data.signature;

  return (
    <div className="space-y-6">
      <PortalSection title="Comprovante de aceite">
        <PortalCard className="p-4">
          <Row label="Colaborador" value={data.employeeName} />
          <Row label="Competência" value={competenceLabel(data.payslip.payroll_period)} />
          <Row label="Versão do documento" value={data.payslip.current_version} />
          <Row label="Data e hora do aceite" value={dateTimeFmt(data.payslip.signed_at)} />
          <Row label="Termo" value={s?.term_version ?? "—"} />
          <Row label="Hash do documento (SHA-256)" value={shortHash(s?.file_sha256)} />
          <Row label="Hash de integridade do aceite" value={shortHash(s?.integrity_hash)} />
          <Row
            label="Validação de identidade"
            value={FACE_STATE_LABEL[s?.face_status ?? "not_required"] ?? s?.face_status ?? "—"}
          />
          <Row
            label="Localização"
            value={
              <>
                {LOCATION_STATE_LABEL[s?.location_status ?? "nao_disponivel"] ?? s?.location_status}
                {s?.geo_address ? ` · ${s.geo_address}` : ""}
                {s?.geo_distance_meters != null ? ` · ${s.geo_distance_meters} m da unidade` : ""}
              </>
            }
          />
          <Row label="IP (mascarado)" value={s?.ip_masked ?? "—"} />
          <Row
            label="Consentimento LGPD"
            value={
              <LgpdConsentSummary
                consent={s?.consent as { data?: boolean; biometrics?: boolean; location?: boolean; version?: string } | null}
              />
            }
          />
        </PortalCard>
      </PortalSection>

      <PortalSection title="Trilha de auditoria">
        <PortalCard className="p-4">
          <ol className="space-y-3">
            {data.events.map((e) => (
              <li key={e.event_hash} className="border-b-2 border-dashed border-foreground/20 pb-3 last:border-0">
                <p className="text-sm font-semibold">
                  {AUDIT_EVENT_LABEL[e.event_type] ?? e.event_type}
                  {e.event_result !== "success" ? ` (${e.event_result})` : ""}
                </p>
                <p className="text-xs text-muted-foreground">{dateTimeFmt(e.occurred_at)}</p>
                <p className="meta-mono break-all text-[10px]">{shortHash(e.event_hash)}</p>
              </li>
            ))}
          </ol>
        </PortalCard>
      </PortalSection>

      <div className="flex gap-2">
        <PortalButton block onClick={() => window.print()}>
          <Printer className="size-4" aria-hidden />
          Imprimir / salvar PDF
        </PortalButton>
        <Link
          to="/portal/holerites/$id"
          params={{ id }}
          className="portal-press inline-flex min-h-[52px] items-center justify-center rounded-[16px] border-2 border-foreground bg-card px-5 text-sm font-bold shadow-[3px_3px_0_var(--ink)]"
        >
          Voltar
        </Link>
      </div>
    </div>
  );
}
