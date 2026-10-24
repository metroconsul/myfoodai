import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { LoadingState, SectionCard, StatusBadge } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useWorkspace } from "@/hooks/use-workspace";
import {
  disconnectMercadoPago,
  getMercadoPagoStatus,
  startMercadoPagoConnect,
  syncMercadoPago,
} from "@/lib/mercado-pago.functions";
import { fmtDateTime } from "../lib/dates";

const RETURN_MESSAGE: Record<string, [ok: boolean, text: string]> = {
  conectado: [true, "Mercado Pago conectado. As vendas dos últimos 30 dias foram importadas."],
  cancelado: [false, "A conexão com o Mercado Pago foi cancelada."],
  expirado: [false, "O pedido de conexão venceu. Tente de novo."],
  conta_em_uso: [false, "Essa conta do Mercado Pago já está ligada a outra empresa."],
  erro: [false, "Não foi possível conectar o Mercado Pago. Tente de novo."],
};

const mpStatusKey = ["cf", "mercado-pago-status"] as const;

/** Card "Conectar Mercado Pago" em Vendas (dono/admin/financeiro). Só leitura de vendas. */
export function MercadoPagoCard() {
  const { units } = useWorkspace();
  const queryClient = useQueryClient();
  const statusFn = useServerFn(getMercadoPagoStatus);
  const startFn = useServerFn(startMercadoPagoConnect);
  const syncFn = useServerFn(syncMercadoPago);
  const disconnectFn = useServerFn(disconnectMercadoPago);
  const [unitId, setUnitId] = useState("");
  const status = useQuery({ queryKey: mpStatusKey, queryFn: () => statusFn() });

  // Mensagem de volta do Mercado Pago (?mp=...), mostrada uma vez.
  useEffect(() => {
    const url = new URL(window.location.href);
    const result = url.searchParams.get("mp");
    if (!result) return;
    const [ok, text] = RETURN_MESSAGE[result] ?? RETURN_MESSAGE["erro"]!;
    if (ok) toast.success(text);
    else toast.error(text);
    url.searchParams.delete("mp");
    window.history.replaceState(null, "", url.toString());
  }, []);

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["cf"] });
  const connect = useMutation({
    mutationFn: () => startFn({ data: { unitId: unitId || units[0]!.id } }),
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível iniciar a conexão."),
  });
  const sync = useMutation({
    mutationFn: () => syncFn(),
    onSuccess: ({ imported }) => {
      toast.success(`${imported} vendas do Mercado Pago atualizadas.`);
      refresh();
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Falha ao sincronizar.");
      refresh();
    },
  });
  const disconnect = useMutation({
    mutationFn: () => disconnectFn(),
    onSuccess: () => {
      toast.success("Mercado Pago desconectado. As vendas já importadas continuam aqui.");
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível desconectar."),
  });

  const s = status.data;
  const unitName = new Map(units.map((u) => [u.id, u.name]));

  return (
    <SectionCard
      title="Mercado Pago"
      action={s?.connected ? <StatusBadge tone={s.lastSyncError ? "warn" : "ok"}>Conectado</StatusBadge> : null}
    >
      {status.isLoading ? (
        <LoadingState />
      ) : status.isError ? (
        <p className="text-sm text-muted-foreground">Não foi possível ver a situação da conexão.</p>
      ) : !s?.configured ? (
        <p className="text-sm text-muted-foreground">A conexão com o Mercado Pago ainda não está disponível.</p>
      ) : s.connected ? (
        <div className="space-y-3 text-sm">
          <p>
            Vendas da maquininha, Pix e link de pagamento entram em{" "}
            <strong>{unitName.get(s.unitId ?? "") ?? "unidade"}</strong>.
          </p>
          <p className="meta-mono">
            {s.lastSyncAt ? `Última atualização: ${fmtDateTime(s.lastSyncAt)}` : "Ainda não sincronizado"}
          </p>
          {s.lastSyncError ? <p className="text-destructive">Erro: {s.lastSyncError}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => sync.mutate()} disabled={sync.isPending}>
              {sync.isPending ? "Sincronizando…" : "Sincronizar agora"}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (window.confirm("Desconectar o Mercado Pago? As vendas já importadas continuam aqui.")) disconnect.mutate();
              }}
              disabled={disconnect.isPending}
            >
              Desconectar
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            Conecte a conta do Mercado Pago do estabelecimento para ver aqui as vendas da maquininha, Pix e link de pagamento.
            O MyFoods só lê as vendas: não cobra, não paga e não movimenta dinheiro.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            {units.length > 1 ? (
              <Select value={unitId || units[0]!.id} onValueChange={setUnitId}>
                <SelectTrigger className="w-48" aria-label="Unidade das vendas">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {units.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            <Button onClick={() => connect.mutate()} disabled={connect.isPending || units.length === 0}>
              {connect.isPending ? "Abrindo o Mercado Pago…" : "Conectar Mercado Pago"}
            </Button>
          </div>
        </div>
      )}
    </SectionCard>
  );
}
