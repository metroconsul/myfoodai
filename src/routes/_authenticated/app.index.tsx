import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Users, Clock, Boxes, ShoppingBag, AlertTriangle, CalendarDays } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";
import { PageHeader, StatCard, SectionCard, EmptyState, StatusBadge, LoadingState } from "@/components/ui-kit";
import { BRAND_NAME } from "@/config/brand";
import { currency, dateTimeFmt, minutesToHours } from "@/lib/format";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/app/")({
  head: () => ({
    meta: [
      { title: `Visão geral — ${BRAND_NAME}` },
      { name: "description", content: "Indicadores de pessoas, ponto, estoque e vendas da unidade." },
      { property: "og:title", content: `Visão geral — ${BRAND_NAME}` },
      { property: "og:description", content: "Painel operacional diário." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Dashboard,
});

type InventoryRow = {
  id: string;
  name: string;
  quantity: number;
  minimum_stock: number;
  unit_of_measure: string;
};
type SalesRow = {
  gross_amount: number;
  orders_count: number;
  average_ticket: number;
  metric_date: string;
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function Dashboard() {
  const { activeUnitId, activeUnit, hasFeature } = useWorkspace();
  const showInventory = hasFeature("inventory");
  const showSales = hasFeature("sales");
  const advancedSchedules = hasFeature("schedules_advanced");

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", activeUnitId, showInventory, showSales],
    enabled: !!activeUnitId,
    queryFn: async () => {
      const unitId = activeUnitId!;
      const today = todayISO();
      const dayStart = new Date(`${today}T00:00:00`).toISOString();

      const [employees, blocks, entries, lowStock, alerts, sales] = await Promise.all([
        supabase
          .from("employees")
          .select("id", { count: "exact", head: true })
          .eq("unit_id", unitId)
          .eq("employment_status", "ativo"),
        supabase
          .from("schedule_blocks")
          .select("id, start_at, end_at, employee_id, employees(full_name)")
          .eq("unit_id", unitId)
          .eq("work_date", today)
          .order("start_at"),
        supabase
          .from("time_entries")
          .select("id, entry_type, server_time, geo_status, employees(full_name)")
          .eq("unit_id", unitId)
          .gte("server_time", dayStart)
          .order("server_time", { ascending: false })
          .limit(8),
        showInventory
          ? supabase
              .from("inventory_items")
              .select("id, name, quantity, minimum_stock, unit_of_measure")
              .eq("unit_id", unitId)
              .eq("active", true)
              .order("quantity")
              .limit(50)
          : Promise.resolve({ data: [] as InventoryRow[], count: 0 }),
        showInventory
          ? supabase
              .from("stock_alerts")
              .select("id", { count: "exact", head: true })
              .eq("unit_id", unitId)
              .is("resolved_at", null)
          : Promise.resolve({ count: 0 }),
        showSales
          ? supabase
              .from("sales_daily_metrics")
              .select("gross_amount, orders_count, average_ticket, metric_date")
              .eq("unit_id", unitId)
              .order("metric_date", { ascending: false })
              .limit(1)
          : Promise.resolve({ data: [] as SalesRow[] }),
      ]);

      const low = (lowStock.data ?? []).filter((i) => Number(i.quantity) <= Number(i.minimum_stock));

      return {
        employeeCount: employees.count ?? 0,
        blocks: blocks.data ?? [],
        entries: entries.data ?? [],
        low,
        alertCount: alerts.count ?? 0,
        sales: sales.data?.[0] ?? null,
      };
    },
  });

  const plannedMinutes = (data?.blocks ?? []).reduce((acc, b) => {
    const diff = (new Date(b.end_at).getTime() - new Date(b.start_at).getTime()) / 60000;
    return acc + Math.max(0, diff);
  }, 0);

  return (
    <>
      <PageHeader
        title="Visão geral"
        description={activeUnit ? `Operação de hoje em ${activeUnit.name}.` : "Selecione uma unidade."}
        actions={
          <Button asChild variant="outline">
            {advancedSchedules ? (
              <Link to="/app/schedules">Ver escalas</Link>
            ) : (
              <Link to="/app/settings/jornada">Ver jornada fixa</Link>
            )}
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Colaboradores ativos" value={data?.employeeCount ?? "—"} icon={<Users className="size-5" />} />
        <StatCard
          label={advancedSchedules ? "Horas planejadas hoje" : "Horas previstas hoje"}
          value={minutesToHours(plannedMinutes)}
          hint={`${data?.blocks.length ?? 0} blocos de escala`}
          icon={<CalendarDays className="size-5" />}
        />
        {showInventory ? (
        <StatCard
          label="Itens abaixo do mínimo"
          value={data?.low.length ?? 0}
          tone={(data?.low.length ?? 0) > 0 ? "warning" : "success"}
          hint={`${data?.alertCount ?? 0} alertas abertos`}
          icon={<Boxes className="size-5" />}
        />
        ) : null}
        {showSales ? (
        <StatCard
          label="Vendas (último dia)"
          value={data?.sales ? currency(Number(data.sales.gross_amount)) : "—"}
          hint={data?.sales ? `${data.sales.orders_count} pedidos` : "Sem conexão de vendas"}
          icon={<ShoppingBag className="size-5" />}
        />
        ) : null}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <SectionCard title="Escala de hoje">
          {isLoading ? (
            <LoadingState />
          ) : (data?.blocks.length ?? 0) === 0 ? (
            <EmptyState
              title="Nenhum turno planejado para hoje"
              description={
                advancedSchedules
                  ? "Crie uma escala para esta unidade."
                  : "Confira a jornada fixa da unidade em Configurações."
              }
            />
          ) : (
            <ul className="divide-y-2 divide-foreground">
              {data!.blocks.map((b) => (
                <li key={b.id} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="font-medium">
                    {(b.employees as { full_name: string } | null)?.full_name ?? "Colaborador"}
                  </span>
                  <span className="text-muted-foreground">
                    {new Date(b.start_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} –{" "}
                    {new Date(b.end_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Últimos registros de ponto">
          {(data?.entries.length ?? 0) === 0 ? (
            <EmptyState title="Nenhum ponto registrado hoje" description="Os registros do portal aparecem aqui." />
          ) : (
            <ul className="divide-y-2 divide-foreground">
              {data!.entries.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-2 py-2.5 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {(e.employees as { full_name: string } | null)?.full_name ?? "Colaborador"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {e.entry_type.replace("_", " ")} · {dateTimeFmt(e.server_time)}
                    </span>
                  </span>
                  <StatusBadge tone={e.geo_status === "dentro_do_raio" ? "ok" : "warn"}>
                    {e.geo_status.replaceAll("_", " ")}
                  </StatusBadge>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      {showInventory && (data?.low.length ?? 0) > 0 ? (
        <div className="mt-4">
          <SectionCard title="Reposição sugerida">
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {data!.low.slice(0, 9).map((i) => (
                <li key={i.id} className="flex items-center gap-2 rounded-[10px] border-2 border-foreground bg-secondary px-3 py-2 text-sm">
                  <AlertTriangle className="size-4 text-warning" aria-hidden />
                  <span className="flex-1 truncate">{i.name}</span>
                  <span className="text-muted-foreground">
                    {Number(i.quantity)} {i.unit_of_measure}
                  </span>
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>
      ) : null}

      <p className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
        <Clock className="size-3.5" aria-hidden /> Dados atualizados em tempo de carregamento da página.
      </p>
    </>
  );
}
