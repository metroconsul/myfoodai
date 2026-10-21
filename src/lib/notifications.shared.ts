import type { Json } from "@/integrations/supabase/types";

export type NotificationPriority = "low" | "normal" | "high" | "urgent";

export type StructuredNotification = {
  id: string;
  notification_type: string;
  title: string;
  message: string;
  priority: NotificationPriority;
  action_url: string | null;
  metadata: Record<string, Json | undefined>;
  created_at: string;
};

type NotificationRow = {
  id: string;
  event_type: string;
  template: string | null;
  payload: Json;
  created_at: string;
};

const EVENT_DEFAULTS: Record<string, Omit<StructuredNotification, "id" | "created_at" | "metadata">> = {
  cartao_ponto_disponivel: {
    notification_type: "CLOCK_ADJUSTMENT",
    title: "Confira seu cartão de ponto",
    message: "Há um cartão de ponto aguardando sua conferência.",
    priority: "high",
    action_url: "/portal/cartao-ponto",
  },
  cartao_ponto_divergencia: {
    notification_type: "CLOCK_ADJUSTMENT",
    title: "Ajuste de ponto enviado",
    message: "Sua divergência de ponto está em análise pela gestão.",
    priority: "normal",
    action_url: "/portal/cartao-ponto",
  },
  entrega_pendente: {
    notification_type: "EPI_PENDING",
    title: "EPI aguardando aceite",
    message: "Confira os itens recebidos e registre seu aceite.",
    priority: "high",
    action_url: "/portal/itens",
  },
  entrega_recusada: {
    notification_type: "EPI_PENDING",
    title: "Recusa de EPI registrada",
    message: "A gestão recebeu o motivo informado por você.",
    priority: "normal",
    action_url: "/portal/itens",
  },
  entrega_divergente: {
    notification_type: "EPI_PENDING",
    title: "Divergência de EPI registrada",
    message: "A gestão recebeu a divergência informada por você.",
    priority: "high",
    action_url: "/portal/itens",
  },
};

function record(value: Json | undefined): Record<string, Json | undefined> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, Json | undefined>)
    : {};
}

function text(value: Json | undefined) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function priority(value: Json | undefined): NotificationPriority | null {
  return value === "low" || value === "normal" || value === "high" || value === "urgent"
    ? value
    : null;
}

/**
 * Compatibilidade entre a fila existente e o contrato estruturado do MVP.
 * Campos novos vivem em `payload` até uma migration aditiva ser aprovada.
 */
export function toStructuredNotification(row: NotificationRow): StructuredNotification {
  const payload = record(row.payload);
  const defaults = EVENT_DEFAULTS[row.event_type];

  return {
    id: row.id,
    notification_type: text(payload["notification_type"]) ?? defaults?.notification_type ?? row.event_type.toUpperCase(),
    title: text(payload["title"]) ?? defaults?.title ?? row.template ?? "Atualização do MyFoods",
    message: text(payload["message"]) ?? defaults?.message ?? "Há uma atualização na sua operação.",
    priority: priority(payload["priority"]) ?? defaults?.priority ?? "normal",
    action_url: text(payload["action_url"]) ?? defaults?.action_url ?? null,
    metadata: record(payload["metadata"]),
    created_at: row.created_at,
  };
}
