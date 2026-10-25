/** Data local AAAA-MM-DD (o isoDate de @/lib/format usa UTC e vira o dia às 21h no Brasil). */
export function localYmd(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function daysAgoYmd(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return localYmd(d);
}
