/**
 * Configuração central da marca.
 * Altere apenas este arquivo (e os tokens em src/styles.css) para trocar
 * nome, logo, favicon e cores em todo o produto.
 */
export const BRAND_NAME = "BRAND_NAME";
export const BRAND_TAGLINE = "Operação de food service em um só lugar";
export const BRAND_LOGO = "/favicon.ico";
export const BRAND_FAVICON = "/favicon.ico";
export const PRIMARY_COLOR = "#F97316";
export const ACCENT_COLOR = "#FDBA74";

export const brand = {
  name: BRAND_NAME,
  tagline: BRAND_TAGLINE,
  logo: BRAND_LOGO,
  favicon: BRAND_FAVICON,
  primaryColor: PRIMARY_COLOR,
  accentColor: ACCENT_COLOR,
};

/** Aplica cores personalizadas da empresa sobre os tokens globais. */
export function applyCompanyBranding(primary?: string | null, accent?: string | null) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (primary) root.style.setProperty("--brand-primary", primary);
  if (accent) root.style.setProperty("--brand-accent", accent);
}
