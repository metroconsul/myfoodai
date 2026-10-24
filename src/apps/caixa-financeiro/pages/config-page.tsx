import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyState, LoadingState, PageHeader, SectionCard } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useWorkspace } from "@/hooks/use-workspace";
import { cfdb, type PaymentMethod } from "../lib/db";
import { cfKeys, useAccounts, useCfSetupState, usePaymentMethods, useRegisters } from "../lib/hooks";

/**
 * Configurações enxutas (pedido de 2026-10-24): só formas de pagamento e caixas.
 * Contas e categorias são criadas automaticamente por "Preparar o app" e não aparecem aqui.
 */

type MethodKind = Exclude<PaymentMethod["kind"], "cash">;

const METHOD_KIND: Record<MethodKind, string> = {
  pix: "Pix",
  debit: "Cartão de débito",
  credit: "Cartão de crédito",
  voucher: "Vale-refeição",
  other: "Outra",
};

function useAction<T>(fn: (v: T) => PromiseLike<{ error: { message: string } | null }>, done: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (v: T) => {
      const { error } = await fn(v);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: cfKeys.all });
      toast.success(done);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível salvar."),
  });
}

export function ConfigPage() {
  const setup = useCfSetupState();
  const prepare = useAction(async () => cfdb.rpc("fin_bootstrap_company"), "App preparado.");

  return (
    <div className="space-y-6">
      <PageHeader title="Configurações" description="Formas de pagamento aceitas e caixas de cada unidade." />
      {!setup.loading && !setup.configured ? (
        <SectionCard>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">Comece criando os caixas e as formas de pagamento padrão.</p>
            <Button onClick={() => prepare.mutate(undefined)} disabled={prepare.isPending}>
              Preparar o app
            </Button>
          </div>
        </SectionCard>
      ) : null}
      <MethodsSection />
      <RegistersSection onPrepareUnits={() => prepare.mutate(undefined)} />
    </div>
  );
}

function MethodsSection() {
  const { company } = useWorkspace();
  const methods = usePaymentMethods();
  const accounts = useAccounts();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<MethodKind>("pix");
  // Formas que não são dinheiro caem na conta bancária criada em "Preparar o app".
  const bank = (accounts.data ?? []).find((a) => a.kind === "bank" && a.active);
  const add = useAction(
    async () =>
      cfdb.from("payment_methods").insert({
        company_id: company!.id,
        name: name.trim(),
        kind,
        settlement_account_id: bank?.id ?? null,
      }),
    "Forma de pagamento adicionada.",
  );
  const toggle = useAction(
    async (v: { id: string; active: boolean }) => cfdb.from("payment_methods").update({ active: v.active }).eq("id", v.id),
    "Forma de pagamento atualizada.",
  );

  return (
    <SectionCard title="Formas de pagamento">
      {methods.isLoading ? (
        <LoadingState />
      ) : (methods.data ?? []).length === 0 ? (
        <EmptyState title="Nenhuma forma de pagamento" />
      ) : (
        <ul className="divide-y divide-foreground/15">
          {(methods.data ?? []).map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="font-medium">{m.name}</span>
              {m.kind === "cash" ? (
                <span className="meta-mono">Sempre ativa</span>
              ) : (
                <Switch
                  checked={m.active}
                  onCheckedChange={(active) => toggle.mutate({ id: m.id, active })}
                  aria-label={`${m.name} ${m.active ? "ativa" : "inativa"}`}
                />
              )}
            </li>
          ))}
        </ul>
      )}
      <form
        className="mt-4 flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) {
            toast.error("Informe o nome.");
            return;
          }
          add.mutate(undefined);
          setName("");
        }}
      >
        <div>
          <Label htmlFor="pm-name">Adicionar forma</Label>
          <Input id="pm-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: iFood, Ticket" />
        </div>
        <Select value={kind} onValueChange={(v) => setKind(v as MethodKind)}>
          <SelectTrigger className="w-44" aria-label="Tipo">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(METHOD_KIND) as MethodKind[]).map((k) => (
              <SelectItem key={k} value={k}>
                {METHOD_KIND[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="submit" disabled={add.isPending}>
          Adicionar
        </Button>
      </form>
    </SectionCard>
  );
}

function RegistersSection({ onPrepareUnits }: { onPrepareUnits: () => void }) {
  const { company, units } = useWorkspace();
  const registers = useRegisters();
  const accounts = useAccounts();
  const [name, setName] = useState("");
  const [unitId, setUnitId] = useState("");
  // Cada caixa usa a conta de dinheiro da sua unidade, criada em "Preparar o app".
  const unitAccount = (id: string) =>
    (accounts.data ?? []).find((a) => a.kind === "cash" && a.unit_id === id && a.active)?.id;
  const add = useAction(
    async () =>
      cfdb.from("cash_registers").insert({
        company_id: company!.id,
        unit_id: unitId,
        name: name.trim(),
        account_id: unitAccount(unitId)!,
      }),
    "Caixa adicionado.",
  );
  const toggle = useAction(
    async (v: { id: string; active: boolean }) => cfdb.from("cash_registers").update({ active: v.active }).eq("id", v.id),
    "Caixa atualizado.",
  );
  const unitName = new Map(units.map((u) => [u.id, u.name]));
  const unitsWithoutCash = units.filter((u) => !unitAccount(u.id));

  return (
    <SectionCard title="Caixas">
      {registers.isLoading ? (
        <LoadingState />
      ) : (registers.data ?? []).length === 0 ? (
        <EmptyState title="Nenhum caixa" />
      ) : (
        <ul className="divide-y divide-foreground/15">
          {(registers.data ?? []).map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="font-medium">
                {unitName.get(r.unit_id) ?? "Unidade"} · {r.name}
              </span>
              <Switch
                checked={r.active}
                onCheckedChange={(active) => toggle.mutate({ id: r.id, active })}
                aria-label={`${r.name} ${r.active ? "ativo" : "inativo"}`}
              />
            </li>
          ))}
        </ul>
      )}
      {unitsWithoutCash.length > 0 && (registers.data ?? []).length > 0 ? (
        <p className="mt-3 text-sm">
          Unidade sem caixa: {unitsWithoutCash.map((u) => u.name).join(", ")}.{" "}
          <button type="button" className="font-semibold underline" onClick={onPrepareUnits}>
            Criar caixa automaticamente
          </button>
        </p>
      ) : null}
      <form
        className="mt-4 flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim() || !unitId) {
            toast.error("Informe o nome e a unidade.");
            return;
          }
          if (!unitAccount(unitId)) {
            toast.error("Use “Criar caixa automaticamente” para preparar esta unidade primeiro.");
            return;
          }
          add.mutate(undefined);
          setName("");
        }}
      >
        <div>
          <Label htmlFor="reg-name">Adicionar caixa</Label>
          <Input id="reg-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Caixa 2, Delivery" />
        </div>
        <Select value={unitId} onValueChange={setUnitId}>
          <SelectTrigger className="w-44" aria-label="Unidade">
            <SelectValue placeholder="Unidade" />
          </SelectTrigger>
          <SelectContent>
            {units.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="submit" disabled={add.isPending}>
          Adicionar
        </Button>
      </form>
    </SectionCard>
  );
}
