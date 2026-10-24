import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AlertTriangle, ArrowDownCircle, ArrowUpCircle, Receipt, Scale, Store } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, LoadingState, PageHeader, SectionCard, StatCard, StatusBadge } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useWorkspace } from "@/hooks/use-workspace";
import { cfdb, type CashMovement } from "../lib/db";
import { cfKeys, useCfRoles, useCfSetupState, usePaymentMethods, useRegisters, useSessions } from "../lib/hooks";
import { fmtDateTime, localDayStartIso } from "../lib/dates";
import { PERIOD_LABEL, addDays, formatBRL, periodRange, sumMoney, type PeriodKey } from "../lib/money";

const TYPE_LABEL: Record<CashMovement["type"], string> = {
  sale: "Venda",
  income: "Outra entrada",
  expense: "Saída",
  withdrawal: "Sangria",
  supply: "Suprimento",
};

/** Valor com sinal para o período: estorno anula o original. */
function signed(m: CashMovement) {
  return (m.reversal_of ? -1 : 1) * Number(m.amount);
}

export function DashboardPage() {
  const { canFinance } = useCfRoles();
  const setup = useCfSetupState();
  const [period, setPeriod] = useState<PeriodKey>("today");
  const range = periodRange(period);
  const methods = usePaymentMethods();
  const methodName = new Map((methods.data ?? []).map((m) => [m.id, m.name]));

  const movements = useQuery({
    queryKey: ["cf", "dashboard-movements", range.from, range.to],
    queryFn: async () => {
      const { data, error } = await cfdb
        .from("cash_movements")
        .select("*")
        .gte("created_at", localDayStartIso(range.from))
        .lt("created_at", localDayStartIso(addDays(range.to, 1)))
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const closed = useQuery({
    queryKey: ["cf", "dashboard-closed", range.from, range.to],
    queryFn: async () => {
      const { data, error } = await cfdb
        .from("cash_sessions")
        .select("*")
        .eq("status", "closed")
        .gte("closed_at", localDayStartIso(range.from))
        .lt("closed_at", localDayStartIso(addDays(range.to, 1)));
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const list = useMemo(() => movements.data ?? [], [movements.data]);
  const sales = sumMoney(list.filter((m) => m.type === "sale").map(signed));
  const otherIn = sumMoney(list.filter((m) => m.type === "income").map(signed));
  const out = sumMoney(list.filter((m) => m.type === "expense").map(signed));
  const differences = sumMoney((closed.data ?? []).map((s) => s.difference ?? 0));

  const byMethod = useMemo(() => {
    const m = new Map<string, number>();
    for (const mv of list.filter((x) => x.type === "sale")) {
      m.set(mv.payment_method_id, sumMoney([m.get(mv.payment_method_id) ?? 0, signed(mv)]));
    }
    return [...m.entries()].filter(([, v]) => v !== 0).sort((a, b) => b[1] - a[1]);
  }, [list]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Visão geral"
        description="Vendas, entradas e saídas do caixa no período."
        actions={
          <Select value={period} onValueChange={(v) => setPeriod(v as PeriodKey)}>
            <SelectTrigger className="w-44" aria-label="Período">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(PERIOD_LABEL) as PeriodKey[]).map((p) => (
                <SelectItem key={p} value={p}>
                  {PERIOD_LABEL[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      {!setup.loading && !setup.configured ? <SetupBanner canConfigure={canFinance} /> : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Vendas" value={formatBRL(sales)} hint={PERIOD_LABEL[period]} icon={<Receipt className="size-5" />} tone="success" />
        <StatCard label="Outras entradas" value={formatBRL(otherIn)} hint={PERIOD_LABEL[period]} icon={<ArrowUpCircle className="size-5" />} />
        <StatCard label="Saídas" value={formatBRL(out)} hint={PERIOD_LABEL[period]} icon={<ArrowDownCircle className="size-5" />} tone="warning" />
        <StatCard
          label="Diferenças de caixa"
          value={formatBRL(differences)}
          hint="Caixas fechados no período"
          icon={<Scale className="size-5" />}
          tone={differences < 0 ? "danger" : "default"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <CashStatus />
        <SectionCard title="Vendas por forma de pagamento">
          {byMethod.length === 0 ? (
            <EmptyState title="Sem vendas no período" />
          ) : (
            <ul className="space-y-2">
              {byMethod.map(([id, value]) => {
                const pct = sales > 0 ? Math.round((value / sales) * 100) : 0;
                return (
                  <li key={id} className="text-sm">
                    <div className="flex justify-between">
                      <span>{methodName.get(id) ?? "—"}</span>
                      <span className="font-semibold">
                        {formatBRL(value)} <span className="meta-mono">({pct}%)</span>
                      </span>
                    </div>
                    <div className="mt-1 h-2 rounded-full border border-foreground bg-secondary">
                      <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>
      </div>

      <SectionCard title="Últimas movimentações">
        {movements.isLoading ? (
          <LoadingState />
        ) : list.length === 0 ? (
          <EmptyState title="Nenhuma movimentação no período" />
        ) : (
          <ul className="divide-y divide-foreground/15">
            {list.slice(0, 12).map((m) => {
              const positive = ["sale", "income", "supply"].includes(m.type) !== Boolean(m.reversal_of);
              return (
                <li key={m.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0">
                    <span className="block font-medium">
                      {m.reversal_of ? "Estorno de " : ""}
                      {TYPE_LABEL[m.type]} · {methodName.get(m.payment_method_id) ?? ""}
                    </span>
                    <span className="meta-mono">{fmtDateTime(m.created_at)}</span>
                  </span>
                  <span className={positive ? "font-semibold" : "font-semibold text-destructive"}>
                    {positive ? "+" : "−"} {formatBRL(m.amount)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}

function SetupBanner({ canConfigure }: { canConfigure: boolean }) {
  const queryClient = useQueryClient();
  const bootstrap = useMutation({
    mutationFn: async () => {
      const { error } = await cfdb.rpc("fin_bootstrap_company");
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: cfKeys.all });
      toast.success("Pronto! Já dá para abrir o caixa.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível preparar o app."),
  });
  return (
    <SectionCard title="Primeiro acesso">
      {canConfigure ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Um clique cria um caixa para cada unidade e as formas de pagamento mais usadas (dinheiro, Pix, débito, crédito e
            vale-refeição).
          </p>
          <Button onClick={() => bootstrap.mutate()} disabled={bootstrap.isPending}>
            {bootstrap.isPending ? "Preparando…" : "Preparar o app"}
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">O app ainda não foi preparado. Peça ao dono ou administrador da empresa.</p>
      )}
    </SectionCard>
  );
}

function CashStatus() {
  const { units } = useWorkspace();
  const sessions = useSessions("open", 100);
  const registers = useRegisters();
  const unitName = new Map(units.map((u) => [u.id, u.name]));
  const regName = new Map((registers.data ?? []).map((r) => [r.id, r.name]));
  const old = (sessions.data ?? []).some((s) => Date.now() - new Date(s.opened_at).getTime() > 24 * 3600 * 1000);

  return (
    <SectionCard
      title="Situação do caixa"
      action={
        <Link to="/caixa-financeiro/caixa" className="text-sm font-semibold underline">
          Ir para o caixa
        </Link>
      }
    >
      {sessions.isLoading ? (
        <LoadingState />
      ) : (sessions.data ?? []).length === 0 ? (
        <EmptyState title="Nenhum caixa aberto" description="Abra um caixa para registrar as vendas do turno." />
      ) : (
        <ul className="space-y-2">
          {(sessions.data ?? []).map((s) => (
            <li key={s.id}>
              <Link
                to="/caixa-financeiro/caixa/$sessionId"
                params={{ sessionId: s.id }}
                className="flex items-center justify-between rounded-[10px] border-2 border-foreground bg-card p-3 hover:bg-accent"
              >
                <span className="flex items-center gap-2">
                  <Store className="size-4" aria-hidden />
                  <span>
                    <span className="block text-sm font-semibold">
                      {unitName.get(s.unit_id) ?? "Unidade"} · {regName.get(s.register_id) ?? "Caixa"}
                    </span>
                    <span className="meta-mono">Aberto em {fmtDateTime(s.opened_at)}</span>
                  </span>
                </span>
                <StatusBadge tone="ok">Aberto</StatusBadge>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {old ? (
        <p className="mt-3 flex items-center gap-2 text-sm">
          <AlertTriangle className="size-4" aria-hidden /> Há caixa aberto há mais de 24 horas. Confira e feche.
        </p>
      ) : null}
    </SectionCard>
  );
}
