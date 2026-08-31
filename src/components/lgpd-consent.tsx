import { ShieldCheck } from "lucide-react";
import {
  LGPD_BIOMETRICS_TEXT,
  LGPD_CONSENT_TITLE,
  LGPD_DATA_TEXT,
  LGPD_LOCATION_TEXT,
  LGPD_NOTICE,
  type LgpdConsent as Consent,
} from "@/lib/lgpd.shared";
import { cn } from "@/lib/utils";

type Props = {
  value: Consent;
  onChange: (next: Consent) => void;
  /** Exibe a autorização de biometria (fluxos com selfie). */
  withBiometrics?: boolean;
  className?: string;
};

function Item({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 text-sm">
      <input
        type="checkbox"
        className="mt-0.5 size-5 shrink-0 rounded-[6px] border-2 border-foreground accent-[var(--acid)]"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{children}</span>
    </label>
  );
}

/** Bloco de consentimento LGPD usado em todos os aceites/assinaturas do colaborador. */
export function LgpdConsent({ value, onChange, withBiometrics = false, className }: Props) {
  const { privacy } = usePortalPolicies();
  const dataText = privacy.dataText ?? LGPD_DATA_TEXT;
  const biometricsText = privacy.biometricsText ?? LGPD_BIOMETRICS_TEXT;
  const locationText = privacy.locationText ?? LGPD_LOCATION_TEXT;
  const noticeText = privacy.noticeText ?? LGPD_NOTICE;
  return (
    <div
      className={cn(
        "space-y-3 rounded-[20px] border-2 border-foreground bg-secondary p-4",
        className,
      )}
    >
      <p className="display-type flex items-center gap-2 text-sm">
        <ShieldCheck className="size-4" aria-hidden />
        {LGPD_CONSENT_TITLE}
      </p>
      <Item checked={value.data} onChange={(v) => onChange({ ...value, data: v })}>
        {LGPD_DATA_TEXT}
      </Item>
      {withBiometrics ? (
        <Item checked={value.biometrics} onChange={(v) => onChange({ ...value, biometrics: v })}>
          {LGPD_BIOMETRICS_TEXT}
        </Item>
      ) : null}
      <Item checked={value.location} onChange={(v) => onChange({ ...value, location: v })}>
        {LGPD_LOCATION_TEXT}
      </Item>
      <p className="text-xs text-muted-foreground">{LGPD_NOTICE}</p>
    </div>
  );
}

/** Exibição somente leitura do consentimento registrado (painel do gestor). */
export function LgpdConsentSummary({
  consent,
}: {
  consent?: { data?: boolean; biometrics?: boolean; location?: boolean; version?: string } | null;
}) {
  const yes = (v?: boolean) => (v ? "autorizado" : "não autorizado");
  if (!consent) return <span>Não registrado</span>;
  return (
    <span>
      Dados: {yes(consent.data)} · Biometria: {yes(consent.biometrics)} · Localização:{" "}
      {yes(consent.location)}
      {consent.version ? ` · ${consent.version}` : ""}
    </span>
  );
}
