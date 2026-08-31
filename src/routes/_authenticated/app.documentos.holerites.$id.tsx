import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ArrowLeft, Ban, Download, RefreshCw, Send, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { BRAND_NAME } from "@/config/brand";
import {
  ErrorState,
  LoadingState,
  PageHeader,
  SectionCard,
  StatusBadge,
} from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LgpdConsentSummary } from "@/components/lgpd-consent";
import { dateFmt, dateTimeFmt } from "@/lib/format";
import {
  cancelPayslip,
  createPayslipVersion,
  payslipFileUrl,
  publishPayslips,
  resolvePayslipDispute,
} from "@/lib/payslips.functions";
import {
  AUDIT_EVENT_LABEL,
  DISPUTE_CATEGORY_LABEL,
  DISPUTE_STATUS_LABEL,
  FACE_STATE_LABEL,
  LOCATION_STATE_LABEL,
  PAYSLIP_STATUS_LABEL,
  PAYSLIP_STATUS_TONE,
  POLICY_LABEL,
  competenceLabel,
  formatBytes,
  shortHash,
} from "@/lib/payslips.shared";

export const Route = createFileRoute("/_authenticated/app/documentos/holerites/$id")({
  head: () => ({
    meta: [
      { title: `Detalhe do holerite — ${BRAND_NAME}` },
      { name: "description", content: "Versões, evidências de aceite e trilha de auditoria do holerite." },
      { property: "og:title", content: `Detalhe do holerite — ${BRAND_NAME}` },
      { property: "og:description", content: "Auditoria completa da entrega e do aceite do documento." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PayslipDetailPage,
});

async function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Falha ao ler o arquivo."));
    reader.readAsDataURL(file);
  });
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-0.5 border-b border-foreground/20 py-2 last:border-0">
      <p className="meta-mono">{label}</p>
      <p className="break-words text-sm">{value}</p>
    </div>
  );
}

function PayslipDetailPage() {
  const { id } = useParams({ from: "/_authenticated/app/documentos/holerites/$id" });
  const queryClient = useQueryClient();
  const urlFn = useServerFn(payslipFileUrl);
  const publishFn = useServerFn(publishPayslips);
  const cancelFn = useServerFn(cancelPayslip);
  const versionFn = useServerFn(createPayslipVersion);
  const disputeFn = useServerFn(resolvePayslipDispute);

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [versionOpen, setVersionOpen] = useState(false);
  const [versionReason, setVersionReason] = useState("");
  const [versionFile, setVersionFile] = useState<File | null>(null);
  const [replies, setReplies] = useState<Record<string, string>>({});

  const query = useQuery({
    queryKey: ["payslip", id],
    queryFn: async () => {
      const [{ data: payslip, error }, { data: versions }, { data: signatures }, { data: disputes }, { data: events }] =
        await Promise.all([
          supabase.from("payslips").select("*").eq("id", id).maybeSingle(),
          supabase.from("payslip_versions").select("*").eq("payslip_id", id).order("version", { ascending: false }),
          supabase.from("payslip_signatures").select("*").eq("payslip_id", id).order("signed_at", { ascending: false }),
          supabase.from("payslip_disputes").select("*").eq("payslip_id", id).order("created_at", { ascending: false }),
          supabase
            .from("payslip_audit_events")
            .select("*")
            .eq("subject_id", id)
            .order("occurred_at", { ascending: false }),
        ]);
      if (error || !payslip) throw new Error("Holerite não encontrado.");
      return {
        payslip,
        versions: versions ?? [],
        signatures: signatures ?? [],
        disputes: disputes ?? [],
        events: events ?? [],
      };
    },
  });

  const employeeQuery = useQuery({
    queryKey: ["payslip-employee", query.data?.payslip.employee_id],
    enabled: !!query.data?.payslip.employee_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("employees")
        .select("id, full_name, employee_code")
        .eq("id", query.data!.payslip.employee_id)
        .maybeSingle();
      return data;
    },
  });

  const openFile = useMutation({
    mutationFn: async (version?: number) => urlFn({ data: { payslipId: id, version } }),
    onSuccess: (res) => window.open(res.url, "_blank", "noopener"),
    onError: (e: Error) => toast.error(e.message),
  });

  const publish = useMutation({
    mutationFn: async () => publishFn({ data: { ids: [id] } }),
    onSuccess: () => {
      toast.success("Holerite publicado no portal.");
      queryClient.invalidateQueries({ queryKey: ["payslip", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancel = useMutation({
    mutationFn: async () => cancelFn({ data: { payslipId: id, reason: cancelReason.trim() } }),
    onSuccess: () => {
      toast.success("Publicação cancelada.");
      setCancelOpen(false);
      queryClient.invalidateQueries({ queryKey: ["payslip", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const newVersion = useMutation({
    mutationFn: async () => {
      if (!versionFile) throw new Error("Selecione o arquivo corrigido.");
      return versionFn({
        data: {
          payslipId: id,
          correctionReason: versionReason.trim(),
          fileName: versionFile.name,
          fileDataUrl: await fileToDataUrl(versionFile),
        },
      });
    },
    onSuccess: () => {
      toast.success("Nova versão criada. Publique para liberar no portal.");
      setVersionOpen(false);
      setVersionFile(null);
      setVersionReason("");
      queryClient.invalidateQueries({ queryKey: ["payslip", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const answerDispute = useMutation({
    mutationFn: async (input: { disputeId: string; status: "em_analise" | "resolvida" }) =>
      disputeFn({
        data: {
          disputeId: input.disputeId,
          status: input.status,
          response: replies[input.disputeId]?.trim() || null,
        },
      }),
    onSuccess: () => {
      toast.success("Divergência atualizada.");
      queryClient.invalidateQueries({ queryKey: ["payslip", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (query.isLoading) return <LoadingState rows={6} label="Carregando holerite…" />;
  if (query.isError || !query.data)
    return (
      <ErrorState
        title="Holerite não encontrado"
        action={
          <Button asChild variant="outline">
            <Link to="/app/documentos/holerites">Voltar</Link>
          </Button>
        }
      />
    );

  const { payslip, versions, signatures, disputes, events } = query.data;
  const signature = signatures[0];
  const canPublish = payslip.status === "draft" || payslip.status === "corrected";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`Holerite ${competenceLabel(payslip.payroll_period)}`}
        title={employeeQuery.data?.full_name ?? "Colaborador"}
        description={POLICY_LABEL[payslip.acceptance_policy]}
        actions={
          <>
            <Button asChild variant="ghost">
              <Link to="/app/documentos/holerites">
                <ArrowLeft className="mr-2 size-4" />
                Voltar
              </Link>
            </Button>
            <Button variant="outline" onClick={() => openFile.mutate(undefined)}>
              <Download className="mr-2 size-4" />
              Abrir documento
            </Button>
            <Button variant="outline" onClick={() => setVersionOpen(true)}>
              <RefreshCw className="mr-2 size-4" />
              Nova versão
            </Button>
            {canPublish ? (
              <Button onClick={() => publish.mutate()} disabled={publish.isPending}>
                <Send className="mr-2 size-4" />
                Publicar
              </Button>
            ) : (
              <Button variant="outline" onClick={() => setCancelOpen(true)}>
                <Ban className="mr-2 size-4" />
                Cancelar publicação
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Situação">
          <Row
            label="Status"
            value={
              <StatusBadge tone={PAYSLIP_STATUS_TONE[payslip.status] ?? "neutral"}>
                {PAYSLIP_STATUS_LABEL[payslip.status] ?? payslip.status}
              </StatusBadge>
            }
          />
          <Row label="Competência" value={competenceLabel(payslip.payroll_period)} />
          <Row label="Identificação" value={payslip.reference_label ?? "Holerite mensal"} />
          <Row label="Versão atual" value={payslip.current_version} />
          <Row label="Publicado em" value={payslip.published_at ? dateTimeFmt(payslip.published_at) : "—"} />
          <Row label="Visualizado em" value={payslip.viewed_at ? dateTimeFmt(payslip.viewed_at) : "—"} />
          <Row label="Assinado em" value={payslip.signed_at ? dateTimeFmt(payslip.signed_at) : "—"} />
          <Row label="Prazo" value={payslip.due_at ? dateFmt(payslip.due_at) : "—"} />
        </SectionCard>

        <SectionCard title="Evidências do aceite">
          {signature ? (
            <>
              <Row
                label="Assinatura"
                value={`${signature.signature_method} · ${signature.signature_reference ?? "—"}`}
              />
              <Row label="Data e hora" value={dateTimeFmt(signature.signed_at)} />
              <Row label="Termo" value={signature.term_version} />
              <Row label="Hash do documento" value={shortHash(signature.file_sha256)} />
              <Row label="Hash de integridade" value={shortHash(signature.integrity_hash)} />
              <Row
                label="Validação facial"
                value={`${FACE_STATE_LABEL[signature.face_status ?? "not_required"] ?? signature.face_status} · ${
                  signature.liveness_status ?? "—"
                }`}
              />
              <Row
                label="Localização"
                value={
                  <>
                    {LOCATION_STATE_LABEL[signature.location_status ?? "nao_disponivel"] ??
                      signature.location_status}
                    {signature.geo_address ? ` · ${signature.geo_address}` : ""}
                    {signature.geo_distance_meters != null
                      ? ` · ${signature.geo_distance_meters} m da unidade`
                      : ""}
                  </>
                }
              />
              <Row label="IP (mascarado)" value={signature.ip_masked ?? "—"} />
              <Row
                label="Consentimento LGPD"
                value={
                  <LgpdConsentSummary
                    consent={
                      signature.consent as
                        | { data?: boolean; biometrics?: boolean; location?: boolean; version?: string }
                        | null
                    }
                  />
                }
              />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Ainda não há aceite registrado para a versão atual.
            </p>
          )}
        </SectionCard>
      </div>

      <SectionCard title="Versões do documento">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b-2 border-foreground text-left">
                <th className="py-2 pr-3">Versão</th>
                <th className="py-2 pr-3">Arquivo</th>
                <th className="py-2 pr-3">Tamanho</th>
                <th className="py-2 pr-3">SHA-256</th>
                <th className="py-2 pr-3">Enviado em</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {versions.map((v) => (
                <tr key={v.id} className="border-b border-foreground/20">
                  <td className="py-2 pr-3 font-semibold">v{v.version}</td>
                  <td className="py-2 pr-3">
                    {v.original_file_name}
                    {v.correction_reason ? (
                      <span className="block text-xs text-muted-foreground">{v.correction_reason}</span>
                    ) : null}
                  </td>
                  <td className="py-2 pr-3">{formatBytes(v.file_size_bytes)}</td>
                  <td className="py-2 pr-3 text-xs">{shortHash(v.file_sha256)}</td>
                  <td className="py-2 pr-3">{dateTimeFmt(v.uploaded_at)}</td>
                  <td className="py-2 text-right">
                    <Button size="sm" variant="outline" onClick={() => openFile.mutate(v.version)}>
                      Abrir
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard title="Divergências">
        {disputes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma divergência registrada.</p>
        ) : (
          <ul className="space-y-3">
            {disputes.map((d) => (
              <li key={d.id} className="rounded-[10px] border-2 border-foreground bg-card p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge tone={d.status === "resolvida" ? "ok" : "warn"}>
                    {DISPUTE_STATUS_LABEL[d.status] ?? d.status}
                  </StatusBadge>
                  <StatusBadge>{DISPUTE_CATEGORY_LABEL[d.category] ?? d.category}</StatusBadge>
                  <span className="meta-mono">{dateTimeFmt(d.created_at)}</span>
                </div>
                <p className="mt-2 text-sm">{d.description}</p>
                {d.hr_response ? (
                  <p className="mt-2 rounded-[8px] border-2 border-foreground bg-secondary p-3 text-xs">
                    Resposta: {d.hr_response}
                  </p>
                ) : null}
                {d.status !== "resolvida" && d.status !== "cancelada" ? (
                  <div className="mt-3 space-y-2">
                    <Label htmlFor={`reply-${d.id}`}>Resposta do RH</Label>
                    <Textarea
                      id={`reply-${d.id}`}
                      value={replies[d.id] ?? ""}
                      onChange={(e) => setReplies((r) => ({ ...r, [d.id]: e.target.value }))}
                      placeholder="Explique a análise e o encaminhamento."
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => answerDispute.mutate({ disputeId: d.id, status: "em_analise" })}
                      >
                        Marcar em análise
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => answerDispute.mutate({ disputeId: d.id, status: "resolvida" })}
                      >
                        Resolver
                      </Button>
                    </div>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="Trilha de auditoria">
        <ol className="space-y-2">
          {events.map((e) => (
            <li
              key={e.id}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-foreground/20 py-2 last:border-0"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold">
                  {AUDIT_EVENT_LABEL[e.event_type] ?? e.event_type}
                  {e.event_result !== "success" ? ` · ${e.event_result}` : ""}
                </p>
                <p className="meta-mono">
                  {dateTimeFmt(e.occurred_at)} · {e.actor_type}
                  {e.subject_version ? ` · v${e.subject_version}` : ""}
                </p>
              </div>
              <span className="meta-mono flex items-center gap-1 text-[10px]">
                <ShieldCheck className="size-3" aria-hidden />
                {shortHash(e.event_hash)}
              </span>
            </li>
          ))}
        </ol>
      </SectionCard>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar publicação</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              O documento deixa de aparecer no portal. O motivo fica registrado na auditoria.
            </p>
            <Label htmlFor="cancel-reason">Motivo</Label>
            <Textarea
              id="cancel-reason"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
            <Button
              className="w-full"
              disabled={cancelReason.trim().length < 3 || cancel.isPending}
              onClick={() => cancel.mutate()}
            >
              Confirmar cancelamento
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={versionOpen} onOpenChange={setVersionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova versão do documento</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="version-reason">Motivo da correção</Label>
            <Textarea
              id="version-reason"
              value={versionReason}
              onChange={(e) => setVersionReason(e.target.value)}
            />
            <Label htmlFor="version-file">Arquivo corrigido</Label>
            <Input
              id="version-file"
              type="file"
              accept="application/pdf,image/png,image/jpeg"
              onChange={(e) => setVersionFile(e.target.files?.[0] ?? null)}
            />
            <Button
              className="w-full"
              disabled={!versionFile || versionReason.trim().length < 3 || newVersion.isPending}
              onClick={() => newVersion.mutate()}
            >
              Enviar nova versão
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
