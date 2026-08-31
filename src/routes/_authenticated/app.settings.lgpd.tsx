import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader, SectionCard, LoadingState, ErrorState, EmptyState } from "@/components/ui-kit";
import { BRAND_NAME } from "@/config/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getCompanyPolicies, savePrivacyPolicy } from "@/lib/policies.functions";
import { DEFAULT_PRIVACY_POLICY, retentionLabel, type PrivacyPolicy } from "@/lib/policies.shared";
import {
  LGPD_BIOMETRICS_TEXT,
  LGPD_DATA_TEXT,
  LGPD_LOCATION_TEXT,
  LGPD_NOTICE,
} from "@/lib/lgpd.shared";

export const Route = createFileRoute("/_authenticated/app/settings/lgpd")({
  head: () => ({
    meta: [
      { title: `Privacidade e LGPD — ${BRAND_NAME}` },
      {
        name: "description",
        content:
          "Defina finalidades, bases legais, prazo de retenção e textos de consentimento usados em todos os aceites do colaborador.",
      },
      { property: "og:title", content: `Privacidade e LGPD — ${BRAND_NAME}` },
      { property: "og:description", content: "Finalidades, bases legais e retenção por empresa." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PrivacyPolicyPage,
});

function ListEditor({
  label,
  items,
  onChange,
}: {
  label: string;
  items: string[];
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  return (
    <div className="space-y-3">
      <Label>{label}</Label>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li
            key={`${item}-${i}`}
            className="flex items-start justify-between gap-3 rounded-[10px] border-2 border-foreground bg-card p-3 text-sm"
          >
            <span>{item}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onChange(items.filter((_, idx) => idx !== i))}
            >
              Remover
            </Button>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Input
          value={draft}
          placeholder="Adicionar item"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && draft.trim().length > 2) {
              e.preventDefault();
              onChange([...items, draft.trim()]);
              setDraft("");
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            if (draft.trim().length > 2) {
              onChange([...items, draft.trim()]);
              setDraft("");
            }
          }}
        >
          Adicionar
        </Button>
      </div>
    </div>
  );
}

function PrivacyPolicyPage() {
  const queryClient = useQueryClient();
  const policiesQuery = useQuery({ queryKey: ["company-policies"], queryFn: () => getCompanyPolicies() });
  const [form, setForm] = useState<PrivacyPolicy>(DEFAULT_PRIVACY_POLICY);

  useEffect(() => {
    if (policiesQuery.data?.privacy) setForm(policiesQuery.data.privacy);
  }, [policiesQuery.data]);

  const isAdmin = policiesQuery.data?.isAdmin ?? false;

  const save = useMutation({
    mutationFn: async () =>
      savePrivacyPolicy({
        data: {
          ...form,
          controllerName: form.controllerName || null,
          dpoName: form.dpoName || null,
          dpoEmail: form.dpoEmail || null,
          retentionNotes: form.retentionNotes || null,
          privacyUrl: form.privacyUrl || null,
          dataText: form.dataText || null,
          biometricsText: form.biometricsText || null,
          locationText: form.locationText || null,
          noticeText: form.noticeText || null,
        },
      }),
    onSuccess: () => {
      toast.success("Política de privacidade salva.");
      queryClient.invalidateQueries({ queryKey: ["company-policies"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível salvar."),
  });

  if (policiesQuery.isLoading) return <LoadingState rows={5} label="Carregando política…" />;
  if (policiesQuery.isError)
    return (
      <ErrorState
        title="Não foi possível carregar a política"
        action={<Button onClick={() => policiesQuery.refetch()}>Tentar novamente</Button>}
      />
    );

  if (!isAdmin)
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Configurações" title="Privacidade e LGPD" />
        <EmptyState
          title="Acesso restrito"
          description="Somente proprietários e administradores da empresa podem visualizar e editar a política de privacidade."
        />
      </div>
    );

  const set = <K extends keyof PrivacyPolicy>(key: K, value: PrivacyPolicy[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Configurações"
        title="Privacidade e LGPD"
        description={`Finalidades, bases legais e retenção aplicadas a todos os aceites eletrônicos. Retenção atual: ${retentionLabel(form.retentionMonths)}.`}
        actions={
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Salvando…" : "Salvar política"}
          </Button>
        }
      />

      <SectionCard title="Responsáveis">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="controller">Controlador dos dados</Label>
            <Input
              id="controller"
              value={form.controllerName ?? ""}
              onChange={(e) => set("controllerName", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dpo">Encarregado (DPO)</Label>
            <Input id="dpo" value={form.dpoName ?? ""} onChange={(e) => set("dpoName", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dpo-email">E-mail do encarregado</Label>
            <Input
              id="dpo-email"
              type="email"
              value={form.dpoEmail ?? ""}
              onChange={(e) => set("dpoEmail", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="privacy-url">Link da política de privacidade</Label>
            <Input
              id="privacy-url"
              placeholder="https://…"
              value={form.privacyUrl ?? ""}
              onChange={(e) => set("privacyUrl", e.target.value)}
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Finalidades e bases legais">
        <div className="grid gap-6 lg:grid-cols-2">
          <ListEditor
            label="Finalidades do tratamento"
            items={form.purposes}
            onChange={(v) => set("purposes", v)}
          />
          <ListEditor
            label="Bases legais (LGPD)"
            items={form.legalBases}
            onChange={(v) => set("legalBases", v)}
          />
        </div>
      </SectionCard>

      <SectionCard title="Retenção">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="retention">Prazo de retenção (meses)</Label>
            <Input
              id="retention"
              inputMode="numeric"
              value={String(form.retentionMonths)}
              onChange={(e) => set("retentionMonths", Number(e.target.value.replace(/\D/g, "")) || 1)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="consent-version">Versão do consentimento</Label>
            <Input
              id="consent-version"
              value={form.consentVersion}
              onChange={(e) => set("consentVersion", e.target.value)}
            />
          </div>
        </div>
        <div className="mt-4 space-y-2">
          <Label htmlFor="retention-notes">Observações sobre descarte</Label>
          <Textarea
            id="retention-notes"
            rows={3}
            value={form.retentionNotes ?? ""}
            onChange={(e) => set("retentionNotes", e.target.value)}
          />
        </div>
      </SectionCard>

      <SectionCard title="Textos de consentimento no Portal">
        <div className="space-y-4">
          {(
            [
              ["dataText", "Tratamento de dados", LGPD_DATA_TEXT],
              ["biometricsText", "Biometria facial", LGPD_BIOMETRICS_TEXT],
              ["locationText", "Localização", LGPD_LOCATION_TEXT],
              ["noticeText", "Aviso de finalidade e direitos", LGPD_NOTICE],
            ] as const
          ).map(([key, label, fallback]) => (
            <div key={key} className="space-y-2">
              <Label htmlFor={key}>{label}</Label>
              <Textarea
                id={key}
                rows={3}
                placeholder={fallback}
                value={form[key] ?? ""}
                onChange={(e) => set(key, e.target.value)}
              />
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            Campos vazios usam o texto padrão do sistema. Alterações valem imediatamente para novos aceites.
          </p>
        </div>
      </SectionCard>
    </div>
  );
}
