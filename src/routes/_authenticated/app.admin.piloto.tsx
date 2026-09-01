import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader, SectionCard, LoadingState, ErrorState, StatusBadge } from "@/components/ui-kit";
import { BRAND_NAME } from "@/config/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { BrTimeInput } from "@/components/ui/br-inputs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listPilotAccounts, provisionPilotAccount, resendPilotInvite } from "@/lib/pilot.functions";

export const Route = createFileRoute("/_authenticated/app/admin/piloto")({
  head: () => ({
    meta: [
      { title: `Contas piloto — ${BRAND_NAME}` },
      {
        name: "description",
        content:
          "Provisione contas piloto com Plano Começo, unidade única e jornada fixa, enviando convite seguro por e-mail.",
      },
      { property: "og:title", content: `Contas piloto — ${BRAND_NAME}` },
      {
        property: "og:description",
        content: "Provisionamento seguro de contas piloto com convite por e-mail.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PilotAdminPage,
});

const WEEKDAYS = [
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sáb" },
  { value: 0, label: "Dom" },
];

function PilotAdminPage() {
  const queryClient = useQueryClient();
  const listQuery = useQuery({ queryKey: ["pilot-accounts"], queryFn: () => listPilotAccounts() });

  const [email, setEmail] = useState("");
  const [organizationName, setOrganizationName] = useState("Casa Creme'o");
  const [unitName, setUnitName] = useState("Casa Creme'o — EDP São José dos Campos");
  const [city, setCity] = useState("São José dos Campos");
  const [responsibleName, setResponsibleName] = useState("");
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [hasBreak, setHasBreak] = useState(false);
  const [breakStart, setBreakStart] = useState("");
  const [breakEnd, setBreakEnd] = useState("");
  const [accessMode, setAccessMode] = useState<"trial" | "admin_grant" | "subscription">("trial");
  const [trialDays, setTrialDays] = useState("30");
  const [grantReason, setGrantReason] = useState("");

  const provision = useMutation({
    mutationFn: async () =>
      provisionPilotAccount({
        data: {
          email,
          organizationName,
          unitName,
          unitType: "cafeteria",
          city,
          responsibleName: responsibleName || undefined,
          weekdays,
          startTime,
          endTime,
          breakStart: hasBreak ? breakStart : null,
          breakEnd: hasBreak ? breakEnd : null,
          billingCycle: "anual",
          accessMode,
          trialDays: accessMode === "trial" ? Number(trialDays) : undefined,
          grantReason: accessMode === "admin_grant" ? grantReason : undefined,
          redirectOrigin: window.location.origin,
        },
      }),
    onSuccess: (res) => {
      toast.success(
        res.alreadyProvisioned
          ? "Este e-mail já possui uma organização vinculada."
          : "Conta piloto criada. O convite foi enviado por e-mail.",
      );
      queryClient.invalidateQueries({ queryKey: ["pilot-accounts"] });
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Não foi possível provisionar a conta."),
  });

  const resend = useMutation({
    mutationFn: async () => resendPilotInvite({ data: { email } }),
    onSuccess: () => toast.success("Novo link de acesso gerado e enviado."),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível reenviar."),
  });

  const timeOk = (v: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
  const valid =
    /.+@.+\..+/.test(email) &&
    organizationName.trim().length > 1 &&
    unitName.trim().length > 1 &&
    weekdays.length > 0 &&
    timeOk(startTime) &&
    timeOk(endTime) &&
    (!hasBreak || (timeOk(breakStart) && timeOk(breakEnd)));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administração da plataforma"
        title="Contas piloto"
        description="Crie a organização piloto com Plano Começo, unidade única e jornada fixa. A senha nunca passa por aqui: o responsável define a dele pelo link do convite."
        actions={
          <Button onClick={() => provision.mutate()} disabled={!valid || provision.isPending}>
            {provision.isPending ? "Provisionando…" : "Criar e enviar convite"}
          </Button>
        }
      />

      <SectionCard title="Responsável e organização">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>E-mail do administrador da cafeteria</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="responsavel@exemplo.com.br"
            />
          </div>
          <div className="space-y-2">
            <Label>Nome do responsável</Label>
            <Input value={responsibleName} onChange={(e) => setResponsibleName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Nome da organização</Label>
            <Input
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Nome da unidade</Label>
            <Input value={unitName} onChange={(e) => setUnitName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Cidade</Label>
            <Input value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Jornada fixa da unidade">
        <p className="mb-3 text-sm text-muted-foreground">
          Informe o horário real da cafeteria. Nenhum horário é presumido pelo sistema.
        </p>
        <div className="flex flex-wrap gap-3">
          {WEEKDAYS.map((day) => (
            <label
              key={day.value}
              className="flex items-center gap-2 rounded-[10px] border-2 border-foreground bg-card px-3 py-2 shadow-[2px_2px_0_var(--ink)]"
            >
              <Checkbox
                checked={weekdays.includes(day.value)}
                onCheckedChange={(checked) =>
                  setWeekdays((prev) =>
                    checked
                      ? [...prev, day.value].sort((a, b) => a - b)
                      : prev.filter((d) => d !== day.value),
                  )
                }
              />
              <span className="text-sm font-semibold">{day.label}</span>
            </label>
          ))}
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Entrada</Label>
            <BrTimeInput value={startTime} onChange={setStartTime} />
          </div>
          <div className="space-y-2">
            <Label>Saída</Label>
            <BrTimeInput value={endTime} onChange={setEndTime} />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Switch checked={hasBreak} onCheckedChange={setHasBreak} id="pilot-break" />
          <Label htmlFor="pilot-break">A jornada possui intervalo</Label>
        </div>
        {hasBreak ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Início do intervalo</Label>
              <BrTimeInput value={breakStart} onChange={setBreakStart} />
            </div>
            <div className="space-y-2">
              <Label>Fim do intervalo</Label>
              <BrTimeInput value={breakEnd} onChange={setBreakEnd} />
            </div>
          </div>
        ) : null}
      </SectionCard>

      <SectionCard title="Plano e acesso">
        <p className="mb-3 text-sm text-muted-foreground">
          Plano Começo anual (R$ 767,04/ano). A cobrança só existe se você escolher assinatura paga.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Forma de acesso</Label>
            <Select value={accessMode} onValueChange={(v) => setAccessMode(v as typeof accessMode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="trial">Período de teste (trial)</SelectItem>
                <SelectItem value="admin_grant">Concessão administrativa</SelectItem>
                <SelectItem value="subscription">Assinatura paga (checkout Stripe)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {accessMode === "trial" ? (
            <div className="space-y-2">
              <Label>Dias de teste</Label>
              <Input
                inputMode="numeric"
                value={trialDays}
                onChange={(e) => setTrialDays(e.target.value.replace(/\D/g, "").slice(0, 3))}
              />
            </div>
          ) : null}
          {accessMode === "admin_grant" ? (
            <div className="space-y-2">
              <Label>Motivo da concessão</Label>
              <Input value={grantReason} onChange={(e) => setGrantReason(e.target.value)} />
            </div>
          ) : null}
        </div>
        {accessMode === "subscription" ? (
          <p className="mt-3 text-sm text-muted-foreground">
            A conta começa como pendente e só é ativada quando o webhook da Stripe confirmar o
            pagamento do Plano Começo anual.
          </p>
        ) : null}
      </SectionCard>

      <SectionCard
        title="Contas piloto existentes"
        action={
          <Button
            variant="outline"
            onClick={() => resend.mutate()}
            disabled={!/.+@.+\..+/.test(email) || resend.isPending}
          >
            Reenviar link de acesso
          </Button>
        }
      >
        {listQuery.isLoading ? (
          <LoadingState rows={3} label="Carregando contas…" />
        ) : listQuery.isError ? (
          <ErrorState
            title="Não foi possível carregar as contas piloto"
            action={<Button onClick={() => listQuery.refetch()}>Tentar novamente</Button>}
          />
        ) : (listQuery.data?.companies ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma conta piloto provisionada ainda.</p>
        ) : (
          <ul className="space-y-3">
            {(listQuery.data?.companies ?? []).map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border-2 border-foreground bg-card p-4 shadow-[2px_2px_0_var(--ink)]"
              >
                <div>
                  <p className="font-semibold">{c.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Plano {c.plan_code} · {c.billing_cycle ?? "—"} · origem {c.access_source}
                    {c.trial_ends_at
                      ? ` · teste até ${new Date(c.trial_ends_at).toLocaleDateString("pt-BR")}`
                      : ""}
                  </p>
                </div>
                <StatusBadge label={c.subscription_status ?? "—"} />
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
