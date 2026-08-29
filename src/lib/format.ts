export const currency = (value?: number | null) =>
  value == null
    ? "—"
    : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

export const numberFmt = (value?: number | null, digits = 2) =>
  value == null ? "—" : new Intl.NumberFormat("pt-BR", { maximumFractionDigits: digits }).format(value);

export const dateFmt = (value?: string | Date | null) =>
  !value ? "—" : new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(value));

export const dateTimeFmt = (value?: string | Date | null) =>
  !value
    ? "—"
    : new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));

export const timeFmt = (value?: string | Date | null) =>
  !value ? "—" : new Intl.DateTimeFormat("pt-BR", { timeStyle: "short" }).format(new Date(value));

export const onlyDigits = (value: string) => value.replace(/\D+/g, "");

export const maskCpf = (value: string) => {
  const d = onlyDigits(value).slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
};

/** Exibe apenas os dígitos finais do CPF no painel. */
export const maskCpfPrivate = (value?: string | null) => {
  if (!value) return "—";
  const d = onlyDigits(value);
  if (d.length < 11) return "•••";
  return `•••.•••.${d.slice(6, 9)}-${d.slice(9)}`;
};

export const minutesToHours = (minutes?: number | null) => {
  if (!minutes) return "0h00";
  const sign = minutes < 0 ? "-" : "";
  const abs = Math.abs(minutes);
  return `${sign}${Math.floor(abs / 60)}h${String(abs % 60).padStart(2, "0")}`;
};

export const isoDate = (d: Date) => d.toISOString().slice(0, 10);

export const startOfWeek = (d: Date) => {
  const date = new Date(d);
  const day = (date.getDay() + 6) % 7; // segunda = 0
  date.setDate(date.getDate() - day);
  date.setHours(0, 0, 0, 0);
  return date;
};

export const addDays = (d: Date, days: number) => {
  const date = new Date(d);
  date.setDate(date.getDate() + days);
  return date;
};

export const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
