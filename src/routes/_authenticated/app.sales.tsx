import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";
import { PageHeader, SectionCard, EmptyState, StatCard, StatusBadge, LoadingState } from "@/components/ui-kit";
import { BRAND_NAME } from "@/config/brand";
import { currency, dateFmt, dateTimeFmt, numberFmt } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShoppingBag, Receipt, TrendingUp, Plug } from "lucide-react";
import { toast } from "sonner";

type AdapterType = "api" | "webhook" | "csv";

const ADAPTERS: { value: AdapterType; label: string; hint: string }[] = [
  { value: "api", label: "API", hint: "A integração busca os dados no provedor por API." },
  { value: "webhook", label: "Webhook", hint: "O provedor envia os dados para o endpoint público." },
  { value: "csv", label: "CSV", hint: "Importação manual de arquivo exportado do PDV." },
];

export const Route = createFileRoute("/_authenticated/app/sales")({
  head: () => ({
    meta: [
      { title: `Vendas — ${BRAND_NAME}` },
      { name: "description", content: "Indicadores de vendas por unidade e conexões de integração com o PDV." },
      { property: "og:title", content: `Vendas — ${BRAND_NAME}` },
      { property: "og:description", content: "Painel de vendas com adapters de API, webhook e CSV." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SalesPage,
});

function randomSecret() {
  return Array.from(crypto.getRandomValues(new Uint8Array(24)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Converte CSV simples (data;bruto;pedidos;liquido;cancelamentos;descontos) em linhas. */
function parseCsv(text: string) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  const rows: {
    date: string;
    gross: number;
    orders: number;
    net: number | null;
    cancellations: number;
    discounts: number | null;
  }[] = [];
  for (const line of lines) {
    const cols = line.split(/[;,\t]/).map((c) => c.trim());
    const date = cols[0] ?? "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue; // ignora cabeçalho e linhas inválidas
    const num = (v?: string) => (v == null || v === "" ? null : Number(v.replace(",", ".")));
    rows.push({
      date,
      gross: num(cols[1]) ?? 0,
      orders: Math.trunc(num(cols[2]) ?? 0),
      net: num(cols[3]),
      cancellations: Math.trunc(num(cols[4]) ?? 0),
      discounts: num(cols[5]),
    });
  }
  return rows;
}

function SalesPage() {
  const { company, activeUnitId, activeUnit } = useWorkspace();
  const queryClient = useQueryClient();
  const [openConnection, setOpenConnection] = useState(false);
  const [connForm, setConnForm] = useState({ provider: "", adapterType: "webhook" as AdapterType });
  const [csvBusy, setCsvBusy] = useState(false);

  const { data: metrics = [], isLoading } = useQuery({
    queryKey: ["sales-metrics", activeUnitId],
    enabled: !!activeUnitId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_daily_metrics")
        .select("*")
        .eq("unit_id", activeUnitId!)
        .order("metric_date", { ascending: false })
        .limit(60);
      if (error) throw error;
      return data;
    },
  });

  const { data: connections = [] } = useQuery({
    queryKey: ["sales-connections"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_connections")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ["sales-jobs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_import_jobs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  const createConnection = useMutation({
    mutationFn: async () => {
      if (!company) throw new Error("Empresa não encontrada.");
      const { error } = await supabase.from("sales_connections").insert({
        company_id: company.id,
        unit_id: activeUnitId,
        provider: connForm.provider.trim() || "PDV",
        adapter_type: connForm.adapterType,
        status: "pendente",
        config: connForm.adapterType === "webhook" ? { secret: randomSecret() } : {},
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Conexão criada. Configure o provedor para começar a receber dados.");
      setOpenConnection(false);
      setConnForm({ provider: "", adapterType: "webhook" });
      queryClient.invalidateQueries({ queryKey: ["sales-connections"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao criar conexão."),
  });

  async function importCsv(file: File) {
    if (!company || !activeUnitId) return;
    setCsvBusy(true);
    try {
      const rows = parseCsv(await file.text());
      if (rows.length === 0) {
        toast.error("Nenhuma linha válida encontrada. Use o formato AAAA-MM-DD;bruto;pedidos.");
        return;
      }
      const { error } = await supabase.from("sales_daily_metrics").upsert(
        rows.map((r) => ({
          company_id: company.id,
          unit_id: activeUnitId,
          metric_date: r.date,
          gross_amount: r.gross,
          net_amount: r.net,
          orders_count: r.orders,
          cancellations: r.cancellations,
          discounts: r.discounts,
          average_ticket: r.orders > 0 ? r.gross / r.orders : null,
        })),
        { onConflict: "unit_id,metric_date" },
      );
      if (error) throw error;
      await supabase.from("sales_import_jobs").insert({
        company_id: company.id,
        unit_id: activeUnitId,
        period_start: rows[rows.length - 1]!.date,
        period_end: rows[0]!.date,
        status: "concluido",
        rows_imported: rows.length,
        started_at: new Date().toISOString(),
        finished_at: new Date().toISOString(),
      });
      toast.success(`${rows.length} dias importados.`);
      queryClient.invalidateQueries({ queryKey: ["sales-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["sales-jobs"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao importar CSV.");
    } finally {
      setCsvBusy(false);
    }
  }

  const totals = useMemo(() => {
    const last30 = metrics.slice(0, 30);
    const gross = last30.reduce((a, m) => a + Number(m.gross_amount), 0);
    const orders = last30.reduce((a, m) => a + Number(m.orders_count), 0);
    return { gross, orders, ticket: orders > 0 ? gross / orders : null, days: last30.length };
  }, [metrics]);

  const maxGross = Math.max(1, ...metrics.map((m) => Number(m.gross_amount)));
  const chart = [...metrics].slice(0, 21).reverse();

  const webhookUrl =
    typeof window !== "undefined" ? `${window.location.origin}/api/public/sales-ingest` : "/api/public/sales-ingest";

  return (
    <>
      <PageHeader
        title="Vendas"
        description={`Indicadores de ${activeUnit?.name ?? "sua unidade"}. Os dados vêm das integrações — nada é estimado.`}
        actions={
          <Dialog open={openConnection} onOpenChange={setOpenConnection}>
            <DialogTrigger asChild>
              <Button>Nova conexão</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Conectar origem de vendas</DialogTitle>
              </DialogHeader>
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  createConnection.mutate();
                }}
              >
                <div className="space-y-1.5">
                  <Label htmlFor="conn-provider">Provedor / PDV</Label>
                  <Input
                    id="conn-provider"
                    required
                    placeholder="Ex.: PDV da loja, marketplace, ERP"
                    value={connForm.provider}
                    onChange={(e) => setConnForm({ ...connForm, provider: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Tipo de adapter</Label>
                  <Select
                    value={connForm.adapterType}
                    onValueChange={(v) => setConnForm({ ...connForm, adapterType: v as AdapterType })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ADAPTERS.map((a) => (
                        <SelectItem key={a.value} value={a.value}>
                          {a.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {ADAPTERS.find((a) => a.value === connForm.adapterType)?.hint}
                  </p>
                </div>
                <Button type="submit" className="w-full" disabled={createConnection.isPending}>
                  {createConnection.isPending ? "Criando…" : "Criar conexão"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Faturamento (últimos dias)"
          value={totals.days ? currency(totals.gross) : "—"}
          hint={totals.days ? `${totals.days} dias com dados` : "Sem dados recebidos"}
          icon={<ShoppingBag className="size-5" />}
        />
        <StatCard
          label="Pedidos"
          value={totals.days ? numberFmt(totals.orders, 0) : "—"}
          icon={<Receipt className="size-5" />}
        />
        <StatCard
          label="Ticket médio"
          value={totals.ticket ? currency(totals.ticket) : "—"}
          icon={<TrendingUp className="size-5" />}
        />
        <StatCard
          label="Conexões ativas"
          value={connections.filter((c) => c.active).length}
          {...(connections.length === 0 ? { hint: "Nenhuma origem conectada" } : {})}
          icon={<Plug className="size-5" />}
        />
      </div>

      <Tabs defaultValue="indicadores" className="mt-6">
        <TabsList>
          <TabsTrigger value="indicadores">Indicadores</TabsTrigger>
          <TabsTrigger value="conexoes">Conexões</TabsTrigger>
          <TabsTrigger value="importacoes">Importações</TabsTrigger>
        </TabsList>

        <TabsContent value="indicadores" className="mt-4 space-y-4">
          <SectionCard title="Faturamento diário">
            {isLoading ? (
              <LoadingState />
            ) : chart.length === 0 ? (
              <EmptyState
                title="Nenhum dado de vendas recebido"
                description="Conecte um PDV por API ou webhook, ou importe um CSV. Nenhum número é gerado automaticamente."
              />
            ) : (
              <div className="flex h-48 items-end gap-1.5">
                {chart.map((m) => (
                  <div key={m.id} className="flex flex-1 flex-col items-center gap-1">
                    <div
                      className="w-full rounded-t bg-primary/80"
                      style={{ height: `${(Number(m.gross_amount) / maxGross) * 100}%` }}
                      title={`${dateFmt(m.metric_date)} · ${currency(Number(m.gross_amount))}`}
                    />
                    <span className="text-[10px] text-muted-foreground">
                      {m.metric_date.slice(8, 10)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {metrics.length > 0 ? (
            <SectionCard title="Detalhe por dia">
              <ul className="divide-y-2 divide-foreground">
                {metrics.slice(0, 20).map((m) => (
                  <li key={m.id} className="flex items-center justify-between py-2.5 text-sm">
                    <span className="font-medium">{dateFmt(m.metric_date)}</span>
                    <span className="text-muted-foreground">
                      {currency(Number(m.gross_amount))} · {m.orders_count} pedidos ·{" "}
                      {m.average_ticket ? currency(Number(m.average_ticket)) : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            </SectionCard>
          ) : null}
        </TabsContent>

        <TabsContent value="conexoes" className="mt-4 space-y-4">
          <SectionCard title="Origens conectadas">
            {connections.length === 0 ? (
              <EmptyState
                title="Nenhuma conexão"
                description="Crie uma conexão de API, webhook ou CSV para receber vendas."
              />
            ) : (
              <ul className="divide-y-2 divide-foreground">
                {connections.map((c) => {
                  const secret = (c.config as { secret?: string } | null)?.secret;
                  return (
                    <li key={c.id} className="space-y-1 py-3 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">
                          {c.provider} · {c.adapter_type}
                        </span>
                        <StatusBadge tone={c.status === "conectado" ? "ok" : c.status === "erro" ? "danger" : "warn"}>
                          {c.status}
                        </StatusBadge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Última sincronização: {dateTimeFmt(c.last_sync_at)}
                        {c.last_sync_error ? ` · ${c.last_sync_error}` : ""}
                      </p>
                      {c.adapter_type === "webhook" && secret ? (
                        <div className="rounded-[10px] border-2 border-foreground bg-secondary p-3 text-xs">
                          <p className="font-medium">Endpoint</p>
                          <code className="break-all">POST {webhookUrl}</code>
                          <p className="mt-2 font-medium">Cabeçalhos</p>
                          <code className="break-all">x-connection-id: {c.id}</code>
                          <br />
                          <code className="break-all">x-connection-secret: {secret}</code>
                          <p className="mt-2 font-medium">Corpo</p>
                          <code className="break-all">
                            {"{ \"unitId\": \"…\", \"metrics\": [{ \"date\": \"2026-01-31\", \"grossAmount\": 0, \"ordersCount\": 0 }] }"}
                          </code>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Importar CSV">
            <p className="mb-3 text-sm text-muted-foreground">
              Formato por linha: <code>AAAA-MM-DD;faturamento;pedidos;liquido;cancelamentos;descontos</code>. Os
              três primeiros campos são obrigatórios.
            </p>
            <Input
              type="file"
              accept=".csv,text/csv"
              disabled={csvBusy || !activeUnitId}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void importCsv(f);
                e.target.value = "";
              }}
            />
          </SectionCard>
        </TabsContent>

        <TabsContent value="importacoes" className="mt-4">
          <SectionCard title="Histórico de importações">
            {jobs.length === 0 ? (
              <EmptyState title="Nenhuma importação registrada" />
            ) : (
              <ul className="divide-y-2 divide-foreground">
                {jobs.map((j) => (
                  <li key={j.id} className="flex items-center justify-between gap-2 py-2.5 text-sm">
                    <span>
                      <span className="block font-medium">
                        {dateFmt(j.period_start)} — {dateFmt(j.period_end)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {j.rows_imported} linhas · {dateTimeFmt(j.created_at)}
                        {j.error ? ` · ${j.error}` : ""}
                      </span>
                    </span>
                    <StatusBadge tone={j.status === "concluido" ? "ok" : j.status === "erro" ? "danger" : "warn"}>
                      {j.status}
                    </StatusBadge>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </TabsContent>
      </Tabs>
    </>
  );
}
