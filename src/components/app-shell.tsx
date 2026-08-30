import {
  FileSignature, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import {
  Boxes,
  Building2,
  CalendarDays,
  CalendarRange,
  ClipboardList,
  Clock,
  FileSpreadsheet,
  History,
  LayoutDashboard,
  LineChart,
  ListChecks,
  LogOut,
  Menu,
  Package,
  PackageCheck,
  ShieldAlert,
  Users,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";
import { BRAND_NAME } from "@/config/brand";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const NAV = [
  {
    label: "Operação",
    items: [{ to: "/app", label: "Visão geral", icon: LayoutDashboard, exact: true }],
  },
  {
    label: "Pessoas",
    items: [
      { to: "/app/employees", label: "Colaboradores", icon: Users },
      { to: "/app/roles-teams", label: "Cargos e equipes", icon: ClipboardList },
      { to: "/app/units", label: "Unidades", icon: Building2 },
    ],
  },
  {
    label: "Escalas e turnos",
    items: [
      { to: "/app/schedules", label: "Escalas", icon: CalendarDays },
      { to: "/app/shifts", label: "Turnos", icon: CalendarRange },
      { to: "/app/schedule-templates", label: "Modelos semanais", icon: FileSpreadsheet },
      { to: "/app/schedule-compliance", label: "Conflitos", icon: ShieldAlert },
      { to: "/app/schedule-history", label: "Histórico", icon: History },
    ],
  },
  {
    label: "Ponto",
    items: [
      { to: "/app/time-entries", label: "Registros de ponto", icon: Clock },
      { to: "/app/point-cards", label: "Cartões de ponto", icon: FileSignature },
    ],
  },
  {
    label: "Itens e entregas",
    items: [
      { to: "/app/items", label: "Itens operacionais", icon: Package },
      { to: "/app/deliveries", label: "Entrega de itens", icon: PackageCheck },
      { to: "/app/delivery-rules", label: "Regras por função", icon: ListChecks },
    ],
  },
  {
    label: "Estoque",
    items: [{ to: "/app/inventory", label: "Estoque por unidade", icon: Boxes }],
  },
  {
    label: "Vendas",
    items: [{ to: "/app/sales", label: "Vendas e conexões", icon: LineChart }],
  },
] as const;

function currentPageLabel(pathname: string) {
  for (const group of NAV) {
    for (const item of group.items) {
      const active = "exact" in item && item.exact ? pathname === item.to : pathname.startsWith(item.to);
      if (active) return item.label;
    }
  }
  return "Painel";
}

export function AppShell({ children }: { children: ReactNode }) {
  const { company, units, activeUnitId, setActiveUnitId } = useWorkspace();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const brandLabel = company?.brand_name || company?.name || BRAND_NAME;
  const activeUnit = units.find((u) => u.id === activeUnitId);

  return (
    <div className="min-h-screen bg-background">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r-2 border-foreground bg-sidebar transition-transform lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 shrink-0 items-center gap-2 border-b-2 border-foreground px-4">
          <span className="flex size-9 items-center justify-center rounded-[8px] border-2 border-foreground bg-accent text-sm font-bold shadow-[2px_2px_0_var(--ink)]">
            {brandLabel.slice(0, 1).toUpperCase()}
          </span>
          <span className="display-type truncate text-[13px] uppercase leading-tight">{brandLabel}</span>
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto lg:hidden"
            onClick={() => setOpen(false)}
            aria-label="Fechar menu"
          >
            <X className="size-5" />
          </Button>
        </div>

        <div className="border-b-2 border-foreground px-3 py-3">
          <p className="meta-mono mb-1">Empresa</p>
          <p className="truncate text-sm font-semibold">{company?.name ?? "—"}</p>
          <div className="mt-2">
            <Select value={activeUnitId ?? ""} onValueChange={setActiveUnitId}>
              <SelectTrigger aria-label="Unidade ativa">
                <SelectValue placeholder="Selecione a unidade" />
              </SelectTrigger>
              <SelectContent>
                {units.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Navegação principal">
          {NAV.map((group) => (
            <div key={group.label} className="mb-5">
              <p className="meta-mono px-2 pb-2">{group.label}</p>
              <ul className="space-y-1">
                {group.items.map((item) => {
                  const active =
                    "exact" in item && item.exact ? pathname === item.to : pathname.startsWith(item.to);
                  const Icon = item.icon;
                  return (
                    <li key={item.to}>
                      <Link
                        to={item.to}
                        onClick={() => setOpen(false)}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex items-center gap-3 rounded-[8px] border-2 px-3 py-2 text-sm font-medium transition-colors",
                          active
                            ? "border-foreground bg-accent text-accent-foreground shadow-[2px_2px_0_var(--ink)]"
                            : "border-transparent text-foreground hover:border-foreground hover:bg-accent",
                        )}
                      >
                        <Icon className="size-4 shrink-0" aria-hidden />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b-2 border-foreground bg-card px-4">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="Abrir menu"
          >
            <Menu className="size-5" />
          </Button>

          <div className="min-w-0">
            <p className="display-type truncate text-base">{currentPageLabel(pathname)}</p>
            <p className="meta-mono truncate">{activeUnit?.name ?? "Todas as unidades"}</p>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {company?.is_demo ? (
              <span className="hidden rounded-[8px] border-2 border-foreground bg-warning px-3 py-1 text-xs font-semibold sm:inline">
                Dados de demonstração
              </span>
            ) : null}
            <Button variant="outline" size="sm" onClick={signOut}>
              <LogOut className="mr-2 size-4" />
              Sair
            </Button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-8">{children}</main>
      </div>

      {open ? (
        <button
          className="fixed inset-0 z-30 bg-foreground/30 lg:hidden"
          aria-label="Fechar menu"
          onClick={() => setOpen(false)}
        />
      ) : null}
    </div>
  );
}
