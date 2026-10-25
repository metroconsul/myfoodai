import { useState } from "react";
import { Download } from "lucide-react";
import { EmptyState, LoadingState, PageHeader, SectionCard, StatusBadge } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { BrDateInput } from "@/components/ui/br-inputs";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useWorkspace } from "@/hooks/use-workspace";
import { dateTimeFmt } from "@/lib/format";
import { localYmd } from "@/lib/local-date";
import { downloadCsv } from "@/lib/csv";
import { ENTRY_TYPE_LABEL, GEO_STATUS_LABEL, label, needsReview } from "../lib/labels";
import { ALL, ENTRIES_LIMIT as LIMIT, entriesCsv, useEmployees, useEntries } from "../lib/queries";

export function RegistrosPage() {
  const { activeUnitId } = useWorkspace();
  const today = localYmd();
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [employeeId, setEmployeeId] = useState(ALL);
  const employees = useEmployees(activeUnitId);
  const entries = useEntries(activeUnitId, from, to, employeeId);
  const list = entries.data ?? [];

  return (
    <>
      <PageHeader title="Registros" description="Todas as batidas, com filtro por período e colaborador." />
      <SectionCard>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="reg-from">De</Label>
            <BrDateInput id="reg-from" value={from} onChange={setFrom} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reg-to">Até</Label>
            <BrDateInput id="reg-to" value={to} onChange={setTo} />
          </div>
          <div className="space-y-1.5">
            <Label>Colaborador</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger className="w-56" aria-label="Colaborador">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos</SelectItem>
                {(employees.data ?? []).map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="outline"
            disabled={list.length === 0}
            onClick={() => downloadCsv(`batidas-${from}-a-${to}.csv`, entriesCsv(list))}
          >
            <Download className="mr-2 size-4" aria-hidden /> Baixar planilha
          </Button>
        </div>
        {from > to ? <p className="mt-2 text-sm text-destructive">A data inicial é depois da final.</p> : null}
      </SectionCard>

      <SectionCard title={`Batidas${list.length ? ` (${list.length})` : ""}`}>
        {!activeUnitId ? (
          <EmptyState title="Selecione uma unidade" />
        ) : entries.isLoading ? (
          <LoadingState />
        ) : list.length === 0 ? (
          <EmptyState title="Nenhuma batida no período" />
        ) : (
          <ul className="divide-y divide-foreground/15">
            {list.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{e.employees?.full_name ?? "Colaborador"}</span>
                  <span className="meta-mono">
                    {label(ENTRY_TYPE_LABEL, e.entry_type)} · {dateTimeFmt(e.server_time)}
                    {e.distance_meters != null ? ` · ${Math.round(e.distance_meters)} m` : ""}
                  </span>
                </span>
                <StatusBadge tone={needsReview(e) ? "warn" : "ok"}>{label(GEO_STATUS_LABEL, e.geo_status)}</StatusBadge>
              </li>
            ))}
          </ul>
        )}
        {list.length === LIMIT ? (
          <p className="mt-3 text-sm text-muted-foreground">Mostrando as {LIMIT} batidas mais recentes. Diminua o período para ver todas.</p>
        ) : null}
      </SectionCard>
    </>
  );
}
