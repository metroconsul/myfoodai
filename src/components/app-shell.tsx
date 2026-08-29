import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
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
  LogOut,
  Menu,
  Package,
  ShieldAlert,
  Users,
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
    label: "Escalas",
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
    items: [{ to: "/app/time-entries", label: "Registros de ponto", icon: Clock }],
  },
] as const;

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

  return (
    <div className="min-h-screen bg-background">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 border-r border-border bg-sidebar transition-transform lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center gap-2 border-b border-border px-5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold">
            {brandLabel.slice(0, 1).toUpperCase()}
          </span>
          <span className="truncate font-semibold">{brandLabel}</span>
        </div>
        <nav className="h-[calc(100vh-4rem)] overflow-y-auto px-3 py-4" aria-label="Navegação principal">
          {NAV.map((group) => (
            <div key={group.label} className="mb-5">
              <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {group.label}
              </p>
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
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                          active
                            ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                            : "text-muted-foreground hover:bg-secondary hover:text-foreground",
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
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-card/90 px-4 backdrop-blur">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="Abrir menu"
          >
            <Menu className="size-5" />
          </Button>

          <Select value={activeUnitId ?? ""} onValueChange={setActiveUnitId}>
            <SelectTrigger className="w-[220px]" aria-label="Unidade ativa">
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

          <div className="ml-auto flex items-center gap-2">
            {company?.is_demo ? (
              <span className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
                Dados de demonstração
              </span>
            ) : null}
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="mr-2 size-4" />
              Sair
            </Button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-8">{children}</main>
      </div>

      {open ? (
        <button
          className="fixed inset-0 z-30 bg-foreground/20 lg:hidden"
          aria-label="Fechar menu"
          onClick={() => setOpen(false)}
        />
      ) : null}
    </div>
  );
}
