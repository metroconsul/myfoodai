import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Campos de data e horário no formato brasileiro.
 * Exibem dd/mm/aaaa e hh:mm, mas comunicam valores ISO (aaaa-mm-dd / hh:mm)
 * para manter compatibilidade com o banco e o restante do app.
 */

const maskDate = (raw: string) => {
  const d = raw.replace(/\D+/g, "").slice(0, 8);
  return d.replace(/(\d{2})(\d)/, "$1/$2").replace(/(\d{2})\/(\d{2})(\d)/, "$1/$2/$3");
};

const maskTime = (raw: string) => {
  const d = raw.replace(/\D+/g, "").slice(0, 4);
  return d.replace(/(\d{2})(\d)/, "$1:$2");
};

const isoToBr = (iso?: string | null) => {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
};

const brToIso = (br: string): string | null => {
  const m = br.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  const day = Number(d);
  const month = Number(mo);
  const year = Number(y);
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || year > 2100) return null;
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (dt.getUTCDate() !== day || dt.getUTCMonth() !== month - 1) return null;
  return `${y}-${mo}-${d}`;
};

const normalizeTime = (t: string): string | null => {
  const m = t.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
};

type CommonProps = {
  id?: string | undefined;
  value: string;
  onChange: (value: string) => void;
  required?: boolean | undefined;
  disabled?: boolean | undefined;
  className?: string | undefined;
  "aria-label"?: string | undefined;
};

export function BrDateInput({ value, onChange, className, ...props }: CommonProps) {
  const [text, setText] = useState(isoToBr(value));
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    setText(isoToBr(value));
    setInvalid(false);
  }, [value]);

  return (
    <Input
      {...props}
      inputMode="numeric"
      placeholder="dd/mm/aaaa"
      maxLength={10}
      value={text}
      className={cn(className, invalid && "border-destructive")}
      onChange={(e) => {
        const masked = maskDate(e.target.value);
        setText(masked);
        if (!masked) {
          setInvalid(false);
          onChange("");
          return;
        }
        const iso = brToIso(masked);
        if (iso) {
          setInvalid(false);
          onChange(iso);
        } else {
          setInvalid(masked.length === 10);
        }
      }}
      onBlur={() => {
        if (text && !brToIso(text)) setInvalid(true);
      }}
    />
  );
}

export function BrTimeInput({ value, onChange, className, ...props }: CommonProps) {
  const [text, setText] = useState(value ? value.slice(0, 5) : "");
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    setText(value ? value.slice(0, 5) : "");
    setInvalid(false);
  }, [value]);

  return (
    <Input
      {...props}
      inputMode="numeric"
      placeholder="hh:mm"
      maxLength={5}
      value={text}
      className={cn(className, invalid && "border-destructive")}
      onChange={(e) => {
        const masked = maskTime(e.target.value);
        setText(masked);
        if (!masked) {
          setInvalid(false);
          onChange("");
          return;
        }
        const t = normalizeTime(masked);
        if (t) {
          setInvalid(false);
          onChange(t);
        } else {
          setInvalid(masked.length === 5);
        }
      }}
      onBlur={() => {
        if (text && !normalizeTime(text)) setInvalid(true);
      }}
    />
  );
}

/**
 * Substitui inputs datetime-local: recebe/devolve "aaaa-mm-ddThh:mm"
 * e renderiza dois campos (data + hora) em formato brasileiro.
 */
export function BrDateTimeInput({ value, onChange, className, id, ...props }: CommonProps) {
  const [datePart, timePart] = (value || "").split("T");
  const setPart = (d: string, t: string) => {
    if (!d && !t) return onChange("");
    onChange(`${d || ""}T${t || "00:00"}`);
  };
  return (
    <div className={cn("grid grid-cols-[1fr_110px] gap-2", className)}>
      <BrDateInput id={id} value={datePart ?? ""} onChange={(d) => setPart(d, timePart ?? "")} {...props} />
      <BrTimeInput
        aria-label="Horário"
        value={timePart ?? ""}
        onChange={(t) => setPart(datePart ?? "", t)}
        {...props}
      />
    </div>
  );
}
