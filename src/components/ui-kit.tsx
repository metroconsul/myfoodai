import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3 animate-rise">
      <div>
        {eyebrow ? <p className="meta-mono mb-1">{eyebrow}</p> : null}
        <h1 className="display-type text-2xl sm:text-3xl">{title}</h1>
        {description ? <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

const STAT_TONES: Record<string, string> = {
  default: "bg-card",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
  info: "bg-info",
};

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  tone?: keyof typeof STAT_TONES;
}) {
  return (
    <div
      className={cn(
        "hover-lift animate-rise rounded-[12px] border-2 border-foreground p-5 shadow-[4px_4px_0_var(--ink)]",
        STAT_TONES[tone],
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="meta-mono text-foreground/70">{label}</p>
          <p className="display-type mt-2 text-3xl">{value}</p>
          {hint ? <p className="mt-2 text-xs text-foreground/70">{hint}</p> : null}
        </div>
        {icon ? (
          <span className="flex size-10 shrink-0 items-center justify-center rounded-[8px] border-2 border-foreground bg-card">
            {icon}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="surface-card flex flex-col items-center justify-center gap-2 px-6 py-14 text-center animate-rise">
      <span className="mb-2 inline-block rounded-[8px] border-2 border-foreground bg-accent px-3 py-1 text-[11px] font-bold uppercase tracking-widest">
        Sem dados
      </span>
      <p className="display-type text-lg">{title}</p>
      {description ? <p className="max-w-md text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

const STATUS_TONES: Record<string, string> = {
  ok: "bg-success text-success-foreground",
  warn: "bg-warning text-warning-foreground",
  danger: "bg-destructive text-destructive-foreground",
  neutral: "bg-card text-muted-foreground",
  brand: "bg-accent text-accent-foreground",
  info: "bg-info text-info-foreground",
};

export function StatusBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: keyof typeof STATUS_TONES;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[8px] border-2 border-foreground px-2.5 py-0.5 text-xs font-semibold",
        STATUS_TONES[tone],
      )}
    >
      {children}
    </span>
  );
}

export function SectionCard({
  title,
  action,
  children,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="surface-card p-5 animate-rise">
      {title || action ? (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title ? <h2 className="text-sm font-bold uppercase tracking-widest">{title}</h2> : <span />}
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function LoadingState({
  rows = 3,
  label = "Carregando…",
}: {
  rows?: number;
  label?: string;
}) {
  return (
    <div role="status" aria-live="polite" className="space-y-3">
      <span className="meta-mono inline-flex items-center gap-2">
        <span className="inline-block size-2 animate-pulse rounded-full bg-accent-foreground" aria-hidden />
        {label}
      </span>
      <div className="space-y-2" aria-hidden>
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="h-11 animate-pulse rounded-[10px] border-2 border-foreground bg-secondary"
          />
        ))}
      </div>
    </div>
  );
}

export function ErrorState({
  title = "Algo não carregou",
  description = "Verifique sua conexão e tente novamente.",
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-2 rounded-[12px] border-2 border-foreground bg-destructive px-6 py-10 text-center text-destructive-foreground shadow-[4px_4px_0_var(--ink)]"
    >
      <span className="mb-1 inline-block rounded-[8px] border-2 border-foreground bg-card px-3 py-1 text-[11px] font-bold uppercase tracking-widest">
        Erro
      </span>
      <p className="display-type text-lg">{title}</p>
      <p className="max-w-md text-sm">{description}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
