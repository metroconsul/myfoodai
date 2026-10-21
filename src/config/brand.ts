/**
 * Configuração central da marca.
 * Altere apenas este arquivo (e os tokens em src/styles.css) para trocar
 * nome, logo, favicon e cores em todo o produto.
 */
export const BRAND_NAME = "MY FOOD'S AI";
export const BRAND_TAGLINE = "Operação de food service em um só lugar";
export const BRAND_LOGO = "/myfoods-logo.png";
export const BRAND_FAVICON = "/myfoods-logo.png";
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

/** Posicionamento comercial do Grupo MyFoods (landing page e compartilhamento). */
export const GROUP_NAME = "Grupo MyFoods";
export const GROUP_TAGLINE = "Aplicativos inteligentes para simplificar a gestão do seu negócio.";
export const SITE_URL = "https://myfoodsai.com";

/**
 * Canal de contato comercial. Altere aqui para trocar o botão "Fale com a MyFoods" e o rodapé.
 * WhatsApp: somente dígitos, com código do país (55) e DDD.
 */
export const CONTACT_WHATSAPP = "5512981759663";
export const CONTACT_WHATSAPP_LABEL = "+55 12 98175-9663";
export const CONTACT_DEFAULT_MESSAGE =
  "Olá! Vim pelo site do Grupo MyFoods e quero conhecer os aplicativos.";

/** Link de contato; sem número configurado, leva à seção de aplicativos. */
export function contactHref(message: string = CONTACT_DEFAULT_MESSAGE): string {
  if (!CONTACT_WHATSAPP) return "#aplicativos";
  return `https://wa.me/${CONTACT_WHATSAPP}?text=${encodeURIComponent(message)}`;
}
