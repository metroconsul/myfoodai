import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { History, Lock, Plus, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, LoadingState, PageHeader, SectionCard, StatCard, StatusBadge } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useWorkspace } from "@/hooks/use-workspace";
import { cfdb, type CashMovement, type MovementType, type PaymentMethod } from "../lib/db";
import {
  cfKeys,
  useCategories,
  useCfRoles,
  useMovements,
  usePaymentMethods,
  useRegisters,
  useSession,
  useSessionCounts,
  useSessions,
  useTransferAccounts,
} from "../lib/hooks";
import { expectedByMethod, formatBRL, parseBRL, sumMoney } from "../lib/money";
import { fmtDateTime } from "../lib/dates";

const TYPE_LABEL: Record<MovementType, string> = {
  sale: "Venda",
  income: "Outra entrada",
  expense: "Saída / pagamento",
  withdrawal: "Sangria",
  supply: "Suprimento",
};

function errMsg(e: unknown) {
  return e instanceof Error ? e.message : "Não foi possível concluir.";
}

/* ----------------------------------------------------------------------------------------------
 * Lista de caixas: abrir ou continuar
 * -------------------------------------------------------------------------------------------- */
export function CaixaListPage() {
  const { units } = useWorkspace();
  const { canOperate } = useCfRoles();
  const registers = useRegisters();
  const open = useSessions("open", 100);
  const [opening, setOpening] = useState<string | null>(null);

  const unitName = new Map(units.map((u) => [u.id, u.name]));
  const openByRegister = new Map((open.data ?? []).map((s) => [s.register_id, s]));
  const active = (registers.data ?? []).filter((r) => r.active);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Caixa"
        description="Abra o caixa no início do turno, registre as movimentações e feche com a conferência."
        actions={
          <Button asChild variant="outline">
            <Link to="/caixa-financeiro/caixa/historico">
              <History className="mr-2 size-4" aria-hidden /> Histórico
            </Link>
          </Button>
        }
      />
      {registers.isLoading || open.isLoading ? (
        <LoadingState />
      ) : active.length === 0 ? (
        <EmptyState
          title="Nenhum caixa disponível"
          description="Faça a configuração inicial em Visão geral ou cadastre um caixa em Configurações."
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {active.map((r) => {
            const session = openByRegister.get(r.id);
            return (
              <li key={r.id} className="rounded-[12px] border-2 border-foreground bg-card p-4 shadow-[4px_4px_0_var(--ink)]">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="meta-mono">{unitName.get(r.unit_id) ?? "Unidade"}</p>
                    <p className="display-type text-lg">{r.name}</p>
                  </div>
                  {session ? <StatusBadge tone="ok">Aberto</StatusBadge> : <StatusBadge tone="neutral">Fechado</StatusBadge>}
                </div>
                {session ? (
                  <>
                    <p className="mt-2 text-sm text-muted-foreground">Aberto em {fmtDateTime(session.opened_at)}</p>
                    <Button asChild className="mt-4 w-full">
                      <Link to="/caixa-financeiro/caixa/$sessionId" params={{ sessionId: session.id }}>
                        Continuar
                      </Link>
                    </Button>
                  </>
                ) : canOperate ? (
                  <Button className="mt-4 w-full" onClick={() => setOpening(r.id)}>
                    Abrir caixa
                  </Button>
                ) : (
                  <p className="mt-4 text-sm text-muted-foreground">Somente operadores abrem o caixa.</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <OpenDialog registerId={opening} onClose={() => setOpening(null)} />
    </div>
  );
}

function OpenDialog({ registerId, onClose }: { registerId: string | null; onClose: () => void }) {
  const [amount, setAmount] = useState("");
  const { userId } = useWorkspace();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const openSession = useMutation({
    mutationFn: async () => {
      const value = parseBRL(amount || "0");
      if (value === null || value < 0) throw new Error("Informe o valor em dinheiro na gaveta.");
      const { data, error } = await cfdb
        .from("cash_sessions")
        .insert({ register_id: registerId!, opening_amount: value, opened_by: userId! })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return data.id;
    },
    onSuccess: (id) => {
      void queryClient.invalidateQueries({ queryKey: cfKeys.all });
      toast.success("Caixa aberto.");
      setAmount("");
      onClose();
      navigate({ to: "/caixa-financeiro/caixa/$sessionId", params: { sessionId: id } });
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <Dialog open={Boolean(registerId)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Abrir caixa</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            openSession.mutate();
          }}
        >
          <div>
            <Label htmlFor="opening">Dinheiro na gaveta (saldo inicial)</Label>
            <Input id="opening" inputMode="decimal" placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={openSession.isPending}>
            {openSession.isPending ? "Abrindo…" : "Abrir caixa"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ----------------------------------------------------------------------------------------------
 * Caixa aberto (ou fechado, só leitura)
 * -------------------------------------------------------------------------------------------- */
export function CaixaSessionPage({ sessionId }: { sessionId: string }) {
  const { units } = useWorkspace();
  const { canOperate } = useCfRoles();
  const session = useSession(sessionId);
  const movements = useMovements(sessionId);
  const methods = usePaymentMethods();
  const categories = useCategories();
  const registers = useRegisters();
  const s = session.data;
  const counts = useSessionCounts(sessionId, s?.status === "closed");
  const [closing, setClosing] = useState(false);

  const cashMethod = (methods.data ?? []).find((m) => m.kind === "cash" && m.active) ?? null;
  const methodName = new Map((methods.data ?? []).map((m) => [m.id, m.name]));
  const catName = new Map((categories.data ?? []).map((c) => [c.id, c.name]));
  const reversed = new Set((movements.data ?? []).filter((m) => m.reversal_of).map((m) => m.reversal_of!));
  const expected = useMemo(
    () => (s ? expectedByMethod(movements.data ?? [], Number(s.opening_amount), cashMethod?.id ?? null) : {}),
    [movements.data, s, cashMethod?.id],
  );

  if (session.isLoading) return <LoadingState />;
  if (!s) return <EmptyState title="Caixa não encontrado" description="Ele pode ser de outra unidade ou empresa." />;

  const isOpen = s.status === "open";
  const sales = sumMoney(
    (movements.data ?? []).filter((m) => m.type === "sale").map((m) => (m.reversal_of ? -Number(m.amount) : Number(m.amount))),
  );
  const register = (registers.data ?? []).find((r) => r.id === s.register_id);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${register?.name ?? "Caixa"} · ${units.find((u) => u.id === s.unit_id)?.name ?? ""}`}
        description={`Aberto em ${fmtDateTime(s.opened_at)}${s.closed_at ? ` · fechado em ${fmtDateTime(s.closed_at)}` : ""}`}
        actions={
          isOpen && canOperate ? (
            <Button onClick={() => setClosing(true)}>
              <Lock className="mr-2 size-4" aria-hidden /> Fechar caixa
            </Button>
          ) : (
            <StatusBadge tone="neutral">Fechado</StatusBadge>
          )
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Saldo inicial" value={formatBRL(s.opening_amount)} />
        <StatCard label="Vendas" value={formatBRL(sales)} tone="success" />
        <StatCard
          label={isOpen ? "Dinheiro esperado na gaveta" : "Diferença no fechamento"}
          value={isOpen ? formatBRL(cashMethod ? (expected[cashMethod.id] ?? 0) : 0) : formatBRL(s.difference)}
          tone={!isOpen && Number(s.difference) < 0 ? "danger" : "default"}
        />
      </div>

      {isOpen && canOperate ? (
        <MovementForm sessionId={sessionId} methods={(methods.data ?? []).filter((m) => m.active)} />
      ) : null}

      <SectionCard title="Movimentações">
        {movements.isLoading ? (
          <LoadingState />
        ) : (movements.data ?? []).length === 0 ? (
          <EmptyState title="Nenhuma movimentação ainda" />
        ) : (
          <ul className="divide-y divide-foreground/15">
            {(movements.data ?? []).map((m) => (
              <MovementRow
                key={m.id}
                m={m}
                methodName={methodName.get(m.payment_method_id) ?? ""}
                categoryName={m.category_id ? catName.get(m.category_id) : undefined}
                canReverse={isOpen && canOperate && !m.reversal_of && !reversed.has(m.id)}
                isReversed={reversed.has(m.id)}
              />
            ))}
          </ul>
        )}
      </SectionCard>

      {!isOpen && counts.data && counts.data.length > 0 ? (
        <SectionCard title="Conferência">
          <ul className="divide-y divide-foreground/15 text-sm">
            {counts.data.map((c) => (
              <li key={c.id} className="grid grid-cols-4 gap-2 py-2">
                <span className="font-medium">{methodName.get(c.payment_method_id)}</span>
                <span>Esperado {formatBRL(c.expected)}</span>
                <span>Conferido {formatBRL(c.counted)}</span>
                <span className={Number(c.difference) < 0 ? "font-semibold text-destructive" : "font-semibold"}>
                  {Number(c.difference) === 0 ? "Sem diferença" : formatBRL(c.difference)}
                </span>
              </li>
            ))}
          </ul>
          {s.notes ? <p className="mt-3 text-sm text-muted-foreground">Observação: {s.notes}</p> : null}
        </SectionCard>
      ) : null}

      {isOpen ? (
        <CloseDialog
          open={closing}
          onClose={() => setClosing(false)}
          sessionId={sessionId}
          expected={expected}
          methods={methods.data ?? []}
        />
      ) : null}
    </div>
  );
}

function MovementRow({
  m,
  methodName,
  categoryName,
  canReverse,
  isReversed,
}: {
  m: CashMovement;
  methodName: string;
  categoryName?: string | undefined;
  canReverse: boolean;
  isReversed: boolean;
}) {
  const { userId } = useWorkspace();
  const queryClient = useQueryClient();
  const reverse = useMutation({
    mutationFn: async () => {
      const { error } = await cfdb.from("cash_movements").insert({
        session_id: m.session_id,
        type: m.type,
        payment_method_id: m.payment_method_id,
        amount: Number(m.amount),
        reversal_of: m.id,
        created_by: userId!,
        description: "Estorno",
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: cfKeys.movements(m.session_id) });
      toast.success("Movimento estornado.");
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  const positive = ["sale", "income", "supply"].includes(m.type) !== Boolean(m.reversal_of);
  return (
    <li className="flex items-center justify-between gap-3 py-2 text-sm">
      <span className="min-w-0">
        <span className="block font-medium">
          {m.reversal_of ? "Estorno de " : ""}
          {TYPE_LABEL[m.type]} · {methodName}
          {isReversed ? <span className="meta-mono ml-2">(estornado)</span> : null}
        </span>
        <span className="meta-mono">
          {fmtDateTime(m.created_at)}
          {categoryName ? ` · ${categoryName}` : ""}
          {m.description && !m.reversal_of ? ` · ${m.description}` : ""}
        </span>
      </span>
      <span className="flex items-center gap-2">
        <span className={positive ? "font-semibold" : "font-semibold text-destructive"}>
          {positive ? "+" : "−"} {formatBRL(m.amount)}
        </span>
        {canReverse ? (
          <Button
            variant="ghost"
            size="sm"
            disabled={reverse.isPending}
            onClick={() => {
              if (window.confirm("Estornar este movimento? O registro original continua no histórico.")) reverse.mutate();
            }}
            aria-label="Estornar"
          >
            <Undo2 className="size-4" aria-hidden />
          </Button>
        ) : null}
      </span>
    </li>
  );
}

function MovementForm({ sessionId, methods }: { sessionId: string; methods: PaymentMethod[] }) {
  const { userId } = useWorkspace();
  const queryClient = useQueryClient();
  const accounts = useTransferAccounts();
  const [type, setType] = useState<MovementType>("sale");
  const [methodId, setMethodId] = useState("");
  const [amount, setAmount] = useState("");
  const [counterId, setCounterId] = useState("");
  const [description, setDescription] = useState("");

  const cashOnly = type === "withdrawal" || type === "supply";
  const cash = methods.find((m) => m.kind === "cash");
  const effectiveMethod = cashOnly ? (cash?.id ?? "") : methodId;

  const add = useMutation({
    mutationFn: async () => {
      const value = parseBRL(amount);
      if (!value || value <= 0) throw new Error("Informe um valor maior que zero.");
      if (!effectiveMethod) throw new Error("Escolha a forma de pagamento.");
      if (cashOnly && !counterId) throw new Error(type === "withdrawal" ? "Escolha para onde vai o dinheiro." : "Escolha de onde vem o dinheiro.");
      const { error } = await cfdb.from("cash_movements").insert({
        session_id: sessionId,
        type,
        payment_method_id: effectiveMethod,
        amount: value,
        category_id: null,
        counter_account_id: cashOnly ? counterId : null,
        description: description.trim() || null,
        created_by: userId!,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: cfKeys.movements(sessionId) });
      toast.success(`${TYPE_LABEL[type]} registrada.`);
      setAmount("");
      setDescription("");
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <SectionCard title="Nova movimentação">
      <form
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6"
        onSubmit={(e) => {
          e.preventDefault();
          add.mutate();
        }}
      >
        <div className="lg:col-span-1">
          <Label>Tipo</Label>
          <Select value={type} onValueChange={(v) => setType(v as MovementType)}>
            <SelectTrigger aria-label="Tipo">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(TYPE_LABEL) as MovementType[]).map((t) => (
                <SelectItem key={t} value={t}>
                  {TYPE_LABEL[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="lg:col-span-1">
          <Label>Forma</Label>
          {cashOnly ? (
            <Input value={cash?.name ?? "Dinheiro"} disabled aria-label="Forma" />
          ) : (
            <Select value={methodId} onValueChange={setMethodId}>
              <SelectTrigger aria-label="Forma de pagamento">
                <SelectValue placeholder="Escolha" />
              </SelectTrigger>
              <SelectContent>
                {methods.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="lg:col-span-1">
          <Label htmlFor="mv-amount">Valor</Label>
          <Input id="mv-amount" inputMode="decimal" placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        {cashOnly ? (
          <div className="lg:col-span-1">
            <Label>{type === "withdrawal" ? "Para onde vai" : "De onde vem"}</Label>
            <Select value={counterId} onValueChange={setCounterId}>
              <SelectTrigger aria-label="Conta">
                <SelectValue placeholder="Escolha a conta" />
              </SelectTrigger>
              <SelectContent>
                {(accounts.data ?? []).map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        <div className="sm:col-span-2 lg:col-span-1">
          <Label htmlFor="mv-desc">Descrição</Label>
          <Input id="mv-desc" placeholder="Opcional" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="flex items-end sm:col-span-2 lg:col-span-6">
          <Button type="submit" disabled={add.isPending}>
            <Plus className="mr-2 size-4" aria-hidden /> Registrar
          </Button>
        </div>
      </form>
    </SectionCard>
  );
}

function CloseDialog({
  open,
  onClose,
  sessionId,
  expected,
  methods,
}: {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  expected: Record<string, number>;
  methods: PaymentMethod[];
}) {
  const queryClient = useQueryClient();
  const [counted, setCounted] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const rows = methods.filter((m) => (expected[m.id] ?? 0) !== 0 || (m.kind === "cash" && m.active));

  const close = useMutation({
    mutationFn: async () => {
      const counts = rows.map((m) => {
        const v = parseBRL(counted[m.id] ?? "");
        if (v === null) throw new Error(`Informe o valor conferido em ${m.name}.`);
        return { payment_method_id: m.id, counted: v };
      });
      const args = notes.trim()
        ? { _session_id: sessionId, _counts: counts, _notes: notes.trim() }
        : { _session_id: sessionId, _counts: counts };
      const { error } = await cfdb.rpc("close_cash_session", args);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: cfKeys.all });
      toast.success("Caixa fechado e lançado no financeiro.");
      onClose();
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const totalCounted = sumMoney(rows.map((m) => parseBRL(counted[m.id] ?? "") ?? 0));
  const totalExpected = sumMoney(rows.map((m) => expected[m.id] ?? 0));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Fechar caixa</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            close.mutate();
          }}
        >
          <p className="text-sm text-muted-foreground">Conte o que há na gaveta e confira as demais formas de pagamento.</p>
          {rows.map((m) => (
            <div key={m.id} className="grid grid-cols-2 items-end gap-3">
              <div>
                <Label htmlFor={`count-${m.id}`}>{m.name}</Label>
                <p className="meta-mono">Esperado {formatBRL(expected[m.id] ?? 0)}</p>
              </div>
              <Input
                id={`count-${m.id}`}
                inputMode="decimal"
                placeholder="0,00"
                value={counted[m.id] ?? ""}
                onChange={(e) => setCounted((c) => ({ ...c, [m.id]: e.target.value }))}
              />
            </div>
          ))}
          <div className="flex justify-between rounded-[8px] border-2 border-foreground bg-secondary p-3 text-sm">
            <span>Diferença</span>
            <span className="font-semibold">{formatBRL(sumMoney([totalCounted, -totalExpected]))}</span>
          </div>
          <div>
            <Label htmlFor="close-notes">Observação</Label>
            <Textarea id="close-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional" />
          </div>
          <Button type="submit" className="w-full" disabled={close.isPending}>
            {close.isPending ? "Fechando…" : "Confirmar fechamento"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ----------------------------------------------------------------------------------------------
 * Histórico de caixas fechados
 * -------------------------------------------------------------------------------------------- */
export function CaixaHistoryPage() {
  const { units } = useWorkspace();
  const closed = useSessions("closed", 100);
  const registers = useRegisters();
  const unitName = new Map(units.map((u) => [u.id, u.name]));
  const regName = new Map((registers.data ?? []).map((r) => [r.id, r.name]));

  return (
    <div className="space-y-6">
      <PageHeader title="Histórico de caixas" description="Últimos 100 caixas fechados, com a diferença da conferência." />
      {closed.isLoading ? (
        <LoadingState />
      ) : (closed.data ?? []).length === 0 ? (
        <EmptyState title="Nenhum caixa fechado ainda" />
      ) : (
        <div className="overflow-x-auto rounded-[12px] border-2 border-foreground bg-card">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b-2 border-foreground bg-secondary text-left">
              <tr>
                <th className="p-3">Fechado em</th>
                <th className="p-3">Unidade · caixa</th>
                <th className="p-3 text-right">Esperado</th>
                <th className="p-3 text-right">Conferido</th>
                <th className="p-3 text-right">Diferença</th>
              </tr>
            </thead>
            <tbody>
              {(closed.data ?? []).map((s) => (
                <tr key={s.id} className="border-b border-foreground/15 last:border-0">
                  <td className="p-3">
                    <Link to="/caixa-financeiro/caixa/$sessionId" params={{ sessionId: s.id }} className="font-medium underline">
                      {fmtDateTime(s.closed_at)}
                    </Link>
                  </td>
                  <td className="p-3">
                    {unitName.get(s.unit_id) ?? "—"} · {regName.get(s.register_id) ?? "Caixa"}
                  </td>
                  <td className="p-3 text-right">{formatBRL(s.expected_total)}</td>
                  <td className="p-3 text-right">{formatBRL(s.counted_total)}</td>
                  <td className={Number(s.difference) < 0 ? "p-3 text-right font-semibold text-destructive" : "p-3 text-right font-semibold"}>
                    {formatBRL(s.difference)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
