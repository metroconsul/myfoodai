import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { dateTimeFmt } from "@/lib/format";
import { toCsv } from "./csv";
import { ENTRY_TYPE_LABEL, GEO_STATUS_LABEL, label } from "./labels";

/** Consultas do MyFoods Ponto usadas em mais de uma tela. */

export const ALL = "todos";
export const ENTRIES_LIMIT = 2000;

export function useEmployees(unitId: string | null) {
  return useQuery({
    queryKey: ["ponto", "employees", unitId],
    enabled: Boolean(unitId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, full_name")
        .eq("unit_id", unitId!)
        .order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Batidas de um período, com filtro por colaborador. Mesmas regras de acesso da tela antiga de marcações. */
export function useEntries(unitId: string | null, from: string, to: string, employeeId: string) {
  return useQuery({
    queryKey: ["ponto", "entries", unitId, from, to, employeeId],
    enabled: Boolean(unitId) && from <= to,
    queryFn: async () => {
      const end = new Date(`${to}T00:00:00`);
      end.setDate(end.getDate() + 1);
      let q = supabase
        .from("time_entries")
        .select("id, employee_id, entry_type, server_time, geo_status, validation_status, distance_meters, employees(full_name)")
        .eq("unit_id", unitId!)
        .gte("server_time", new Date(`${from}T00:00:00`).toISOString())
        .lt("server_time", end.toISOString())
        .order("server_time", { ascending: false })
        .limit(ENTRIES_LIMIT);
      if (employeeId !== ALL) q = q.eq("employee_id", employeeId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function entriesCsv(entries: NonNullable<ReturnType<typeof useEntries>["data"]>) {
  return toCsv(
    ["Colaborador", "Tipo", "Data e hora", "Localização", "Distância (m)", "Validação"],
    entries.map((e) => [
      e.employees?.full_name ?? "",
      label(ENTRY_TYPE_LABEL, e.entry_type),
      dateTimeFmt(e.server_time),
      label(GEO_STATUS_LABEL, e.geo_status),
      e.distance_meters != null ? Math.round(e.distance_meters) : "",
      e.validation_status,
    ]),
  );
}

