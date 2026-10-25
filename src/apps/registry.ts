import { Clock, QrCode, FileText, ShoppingCart, Wallet, type LucideIcon } from "lucide-react";
import type { FeatureCode } from "@/config/features";

export type AppId = "ponto" | "documentos" | "estoque" | "compras" | "caixa-financeiro" | "cardapio";
export type AppRole =
  | "owner"
  | "admin"
  | "unit_manager"
  | "hr"
  | "stock_manager"
  | "supervisor"
  | "staff"
  | "cashier"
  | "finance";

export interface AppManifest {
  id: AppId;
  name: string;
  description: string;
  icon: LucideIcon;
  /** Código em feature_entitlements que libera o app para a empresa. */
  entitlement: FeatureCode;
  /** "available" = o app já existe no produto; "soon" = ainda não foi construído. */
  status: "available" | "soon";
  /** Entrada do app. Até a etapa F2, os apps existentes abrem nas telas atuais de /app. */
  entry: string;
  /** Papéis que podem abrir o app (a autorização de cada ação continua no banco). */
  roles: AppRole[];
  /** Cor de destaque do card, dentro da identidade MyFoods. */
  tone: "acid" | "ember" | "ink" | "paper";
}

export const APPS: AppManifest[] = [
  {
    id: "ponto",
    name: "MyFoods Ponto",
    description: "Controle de jornada e gestão de funcionários.",
    icon: Clock,
    entitlement: "app_ponto",
    status: "available",
    entry: "/ponto",
    roles: ["owner", "admin", "hr", "unit_manager", "supervisor"],
    tone: "acid",
  },
  {
    id: "cardapio",
    name: "MyFoods Cardápio Digital",
    description: "Cardápio por link e QR code: o cliente pede pelo celular e paga na conta.",
    icon: QrCode,
    entitlement: "app_cardapio",
    status: "available",
    entry: "/cardapio",
    // Qualquer funcionário com login acompanha os pedidos; a gestão monta o cardápio (regras no banco).
    roles: ["owner", "admin", "unit_manager", "hr", "stock_manager", "supervisor", "staff", "cashier", "finance"],
    tone: "ember",
  },
  {
    id: "documentos",
    name: "MyFoods Documentos",
    description: "Holerites, documentos dos colaboradores e entrega de EPIs.",
    icon: FileText,
    entitlement: "app_documentos",
    status: "available",
    entry: "/app/conformidade/exames",
    roles: ["owner", "admin", "hr", "unit_manager"],
    tone: "ink",
  },
  {
    id: "caixa-financeiro",
    name: "MyFoods Caixa & Financeiro",
    description: "Operação de caixa, vendas e controle financeiro em um único aplicativo.",
    icon: Wallet,
    entitlement: "app_caixa_financeiro",
    status: "available",
    entry: "/caixa-financeiro",
    roles: ["owner", "admin", "unit_manager", "cashier", "finance"],
    tone: "paper",
  },
  {
    id: "compras",
    name: "MyFoods Compras",
    description: "Listas do que falta, por loja, para enviar em PDF a quem faz as compras.",
    icon: ShoppingCart,
    entitlement: "app_compras",
    status: "available",
    entry: "/compras",
    // Qualquer funcionário com login anota o que falta (decisão de 2026-10-25).
    roles: ["owner", "admin", "unit_manager", "hr", "stock_manager", "supervisor", "staff", "cashier", "finance"],
    tone: "paper",
  },
];

export type AppAccess = "open" | "not_contracted" | "no_role" | "soon";

export interface AccessContext {
  hasFeature: (code: FeatureCode) => boolean;
  roles: string[];
  isPlatformAdmin: boolean;
}

/**
 * Situação do app para o usuário logado. Só controla a interface; quem decide cada ação é o banco.
 * Ordem: app ainda não construído → não contratado pela empresa → papel sem acesso → liberado.
 */
export function appAccess(app: AppManifest, ctx: AccessContext): AppAccess {
  if (app.status === "soon") return "soon";
  if (ctx.isPlatformAdmin) return "open";
  if (!ctx.hasFeature(app.entitlement)) return "not_contracted";
  if (!ctx.roles.some((role) => (app.roles as string[]).includes(role))) return "no_role";
  return "open";
}

export function appById(id: AppId): AppManifest {
  const app = APPS.find((a) => a.id === id);
  if (!app) throw new Error(`Aplicativo desconhecido: ${id}`);
  return app;
}
