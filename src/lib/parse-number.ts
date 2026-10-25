/** Número digitado: "1,5", "1.5" e "1.234,5" funcionam; vazio ou inválido → NaN. */
export function parseNumber(s: string): number {
  const t = s.trim();
  if (t === "") return NaN;
  return Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
}
