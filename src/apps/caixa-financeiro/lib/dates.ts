/** Datas do Caixa & Financeiro (exibição em pt-BR e filtros no fuso de quem usa). */

/** Início do dia local em ISO (UTC), para filtrar timestamps no fuso de quem usa. */
export function localDayStartIso(ymd: string) {
  return new Date(`${ymd}T00:00:00`).toISOString();
}

export function fmtDate(v: string | null | undefined) {
  if (!v) return "—";
  const d = v.length === 10 ? new Date(`${v}T12:00:00`) : new Date(v);
  return d.toLocaleDateString("pt-BR");
}

export function fmtDateTime(v: string | null | undefined) {
  if (!v) return "—";
  return new Date(v).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}
