import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader, SectionCard, LoadingState, ErrorState, StatusBadge } from "@/components/ui-kit";
import { BRAND_NAME } from "@/config/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getCompanyPolicies, saveAcceptancePolicy } from "@/lib/policies.functions";
import {
  DEFAULT_ACCEPTANCE_POLICY,
  FACE_PROVIDER_LABEL,
  GEOCODING_PROVIDER_LABEL,
  SIGNATURE_METHOD_LABEL,
  type AcceptancePolicy,
} from "@/lib/policies.shared";

export const Route = createFileRoute("/_authenticated/app/settings/aceite")({
  head: () => ({
    meta: [
      { title: `Políticas de aceite — ${BRAND_NAME}` },
      {
        name: "description",
        content:
          "Defina prazo, método de assinatura, geocerca e provedores de validação facial e localização usados no Portal do Colaborador.",
      },
      { property: "og:title", content: `Políticas de aceite — ${BRAND_NAME}` },
      { property: "og:description", content: "Prazo, assinatura, geocerca e provedores por empresa." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AcceptancePolicyPage,
});

function AcceptancePolicyPage() {
  const queryClient = useQueryClient();
  const policiesQuery = useQuery({
    queryKey: ["company-policies"],
    queryFn: () => getCompanyPolicies(),
  });
  const [form, setForm] = useState<AcceptancePolicy>(DEFAULT_ACCEPTANCE_POLICY);

  useEffect(() => {
    if (policiesQuery.data?.acceptance) setForm(policiesQuery.data.acceptance);
  }, [policiesQuery.data]);

  const isAdmin = policiesQuery.data?.isAdmin ?? false;

  const save = useMutation({
    mutationFn: async () =>
      saveAcceptancePolicy({
        data: {
          ...form,
          faceProviderEndpoint: form.faceProviderEndpoint || null,
          geocodingEndpoint: form.geocodingEndpoint || null,
        },
      }),
    onSuccess: () => {
      toast.success("Política de aceite salva.");
      queryClient.invalidateQueries({ queryKey: ["company-policies"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível salvar."),
  });

  if (policiesQuery.isLoading) return <LoadingState rows={5} label="Carregando políticas…" />;
  if (policiesQuery.isError)
    return (
      <ErrorState
        title="Não foi possível carregar as políticas"
        action={<Button onClick={() => policiesQuery.refetch()}>Tentar novamente</Button>}
      />
    );

  const set = <K extends keyof AcceptancePolicy>(key: K, value: AcceptancePolicy[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Configurações"
        title="Políticas de aceite"
        description="Estas regras valem para entrega de itens, cartão de ponto, documentos e holerites no Portal do Colaborador."
        actions={
          isAdmin ? (
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "Salvando…" : "Salvar política"}
            </Button>
          ) : (
            <StatusBadge tone="warn">Somente leitura</StatusBadge>
          )
        }
      />

      <fieldset disabled={!isAdmin} className="space-y-6">
        <SectionCard title="Prazo e assinatura">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="deadline">Prazo padrão para aceite (dias)</Label>
              <Input
                id="deadline"
                inputMode="numeric"
                value={String(form.deadlineDays)}
                onChange={(e) => set("deadlineDays", Number(e.target.value.replace(/\D/g, "")) || 1)}
              />
            </div>
            <div className="space-y-2">
              <Label>Método de assinatura exigido</Label>
              <Select
                value={form.signatureMethod}
                onValueChange={(v) => set("signatureMethod", v as AcceptancePolicy["signatureMethod"])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SIGNATURE_METHOD_LABEL).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            <label className="flex items-center gap-3 text-sm">
              <Checkbox
                checked={form.requireFace}
                onCheckedChange={(v) => set("requireFace", Boolean(v))}
              />
              Exigir validação facial antes da assinatura
            </label>
            <label className="flex items-center gap-3 text-sm">
              <Checkbox
                checked={form.requireLocation}
                onCheckedChange={(v) => set("requireLocation", Boolean(v))}
              />
              Exigir localização no momento do aceite
            </label>
            <label className="flex items-center gap-3 text-sm">
              <Checkbox
                checked={form.allowTypedSignature}
                onCheckedChange={(v) => set("allowTypedSignature", Boolean(v))}
              />
              Permitir assinatura digitada (além da desenhada)
            </label>
          </div>
        </SectionCard>

        <SectionCard title="Geocerca">
          <div className="space-y-3">
            <label className="flex items-center gap-3 text-sm">
              <Checkbox
                checked={form.geofenceEnabled}
                onCheckedChange={(v) => set("geofenceEnabled", Boolean(v))}
              />
              Usar raio próprio da política (em vez do raio da unidade)
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="radius">Raio da geocerca (metros)</Label>
                <Input
                  id="radius"
                  inputMode="numeric"
                  value={String(form.geofenceRadiusMeters)}
                  onChange={(e) =>
                    set("geofenceRadiusMeters", Number(e.target.value.replace(/\D/g, "")) || 20)
                  }
                />
              </div>
            </div>
            <label className="flex items-center gap-3 text-sm">
              <Checkbox
                checked={form.geofenceBlockOutside}
                onCheckedChange={(v) => set("geofenceBlockOutside", Boolean(v))}
              />
              Sinalizar aceites fora do raio como divergência na auditoria
            </label>
          </div>
        </SectionCard>

        <SectionCard title="Provedores">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Validação facial</Label>
              <Select
                value={form.faceProvider}
                onValueChange={(v) => set("faceProvider", v as AcceptancePolicy["faceProvider"])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(FACE_PROVIDER_LABEL).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="face-endpoint">Endpoint do provedor externo</Label>
              <Input
                id="face-endpoint"
                placeholder="https://api.provedor.com/verificar"
                value={form.faceProviderEndpoint ?? ""}
                onChange={(e) => set("faceProviderEndpoint", e.target.value || null)}
                disabled={form.faceProvider !== "externo"}
              />
            </div>
            <div className="space-y-2">
              <Label>Resolução de endereço (geolocalização)</Label>
              <Select
                value={form.geocodingProvider}
                onValueChange={(v) => set("geocodingProvider", v as AcceptancePolicy["geocodingProvider"])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(GEOCODING_PROVIDER_LABEL).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="geo-endpoint">Endpoint de geocodificação própria</Label>
              <Input
                id="geo-endpoint"
                placeholder="https://geo.suaempresa.com/reverse"
                value={form.geocodingEndpoint ?? ""}
                onChange={(e) => set("geocodingEndpoint", e.target.value || null)}
                disabled={form.geocodingProvider !== "custom"}
              />
            </div>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            O provedor externo recebe <code>POST</code> com <code>{"{ image }"}</code> e deve responder{" "}
            <code>{"{ status, liveness, reference, message }"}</code>. A chave é lida do segredo{" "}
            <code>FACE_PROVIDER_API_KEY</code> quando configurada.
          </p>
        </SectionCard>
      </fieldset>
    </div>
  );
}
