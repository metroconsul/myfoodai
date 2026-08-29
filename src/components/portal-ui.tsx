import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Card principal do portal: raio grande, borda preta, sombra dura. */
export function PortalCard({
  children,
  className,
  as: As = "section",
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "div" | "article";
}) {
  return <As className={cn("portal-card animate-rise p-5", className)}>{children}</As>;
}

/** Card interno / item de lista. */
export function PortalTile({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("portal-tile p-4", className)}>{children}</div>;
}

export function PortalLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground", className)}>
      {children}
    </p>
  );
}

export function PortalSection({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex items-end justify-between gap-3">
        <h2 className="display-type text-lg">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

const PORTAL_BTN_VARIANTS = {
  primary: "bg-accent text-accent-foreground shadow-[4px_4px_0_var(--ink)]",
  dark: "bg-foreground text-background shadow-[4px_4px_0_var(--ink)]",
  secondary: "bg-card text-foreground shadow-[3px_3px_0_var(--ink)]",
} as const;

export type PortalButtonVariant = keyof typeof PORTAL_BTN_VARIANTS;

/** Botão do portal: mesma paleta, formas mais suaves. */
export function PortalButton({
  variant = "primary",
  className,
  loading,
  children,
  block,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: PortalButtonVariant;
  loading?: boolean;
  block?: boolean;
}) {
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "portal-press inline-flex min-h-[52px] items-center justify-center gap-2 rounded-[16px] border-2 border-foreground px-5 text-sm font-bold",
        "disabled:pointer-events-none disabled:opacity-50",
        block && "w-full",
        PORTAL_BTN_VARIANTS[variant],
        className,
      )}
    >
      {loading ? (
        <span
          aria-hidden
          className="size-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      ) : null}
      {children}
    </button>
  );
}

/** Botão circular de ação (sempre com label acessível). */
export function PortalIconButton({
  label,
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      {...props}
      aria-label={label}
      title={label}
      className={cn(
        "portal-press inline-flex size-12 items-center justify-center rounded-full border-2 border-foreground bg-accent text-accent-foreground shadow-[3px_3px_0_var(--ink)]",
        className,
      )}
    >
      {children}
    </button>
  );
}

const CHIP_TONES = {
  acid: "bg-accent text-accent-foreground",
  ink: "bg-foreground text-background",
  paper: "bg-background text-foreground",
  card: "bg-card text-foreground",
  warn: "bg-warning text-warning-foreground",
  info: "bg-info text-info-foreground",
  danger: "bg-destructive text-destructive-foreground",
} as const;

export function PortalChip({
  children,
  tone = "card",
  className,
}: {
  children: ReactNode;
  tone?: keyof typeof CHIP_TONES;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border-2 border-foreground px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em]",
        CHIP_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Ícone em contêiner quadrado arredondado (32–40px). */
export function PortalIconBox({
  children,
  tone = "acid",
  className,
}: {
  children: ReactNode;
  tone?: "acid" | "paper";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex size-10 shrink-0 items-center justify-center rounded-[12px] border-2 border-foreground",
        tone === "acid" ? "bg-accent text-accent-foreground" : "bg-background text-foreground",
        className,
      )}
      aria-hidden
    >
      {children}
    </span>
  );
}

/** Métrica compacta estilo bento. */
export function PortalMetric({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="portal-tile flex items-start gap-3 p-4">
      {icon ? <PortalIconBox>{icon}</PortalIconBox> : null}
      <div className="min-w-0">
        <PortalLabel>{label}</PortalLabel>
        <p className="display-type mt-1 truncate text-xl">{value}</p>
        {hint ? <p className="mt-1 truncate text-xs text-muted-foreground">{hint}</p> : null}
      </div>
    </div>
  );
}

/** Estado vazio acolhedor. */
export function PortalEmpty({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="portal-card animate-rise flex flex-col items-center gap-2 px-6 py-10 text-center">
      <PortalChip tone="acid">Sem dados</PortalChip>
      <p className="display-type mt-1 text-base">{title}</p>
      {description ? <p className="max-w-xs text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function PortalLoading({ rows = 3, label = "Carregando…" }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-live="polite" className="space-y-3">
      <span className="meta-mono inline-flex items-center gap-2">
        <span className="inline-block size-2 animate-pulse rounded-full bg-accent-foreground" aria-hidden />
        {label}
      </span>
      <div className="space-y-3" aria-hidden>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-[20px] border-2 border-foreground bg-secondary" />
        ))}
      </div>
    </div>
  );
}

export function PortalError({
  title = "Não foi possível concluir agora",
  description = "Tente novamente em instantes.",
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div
      role="alert"
      className="animate-rise flex flex-col items-center gap-2 rounded-[24px] border-2 border-foreground bg-destructive px-6 py-8 text-center text-destructive-foreground shadow-[4px_4px_0_var(--ink)]"
    >
      <PortalChip tone="card">Erro</PortalChip>
      <p className="display-type mt-1 text-base">{title}</p>
      <p className="max-w-xs text-sm">{description}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

/** Campo de formulário do portal. */
export function PortalField({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-[11px] font-bold uppercase tracking-[0.12em]">
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export const portalInputClass =
  "h-[52px] w-full rounded-[16px] border-2 border-foreground bg-card px-4 text-base font-medium text-foreground shadow-[3px_3px_0_var(--ink)] placeholder:text-muted-foreground focus-visible:outline-3 focus-visible:outline-accent";

/** Checkbox circular com acid green. */
export function PortalCheck({ checked, label }: { checked: boolean; label: string }) {
  return (
    <span
      role="img"
      aria-label={label}
      className={cn(
        "inline-flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-foreground text-lg font-bold",
        checked ? "bg-accent text-accent-foreground" : "bg-card text-muted-foreground",
      )}
    >
      {checked ? "✓" : ""}
    </span>
  );
}
