import { createFileRoute } from "@tanstack/react-router";

/**
 * Webhook público da Stripe.
 * Recebe eventos de assinatura, valida o header Stripe-Signature (HMAC-SHA256)
 * com STRIPE_WEBHOOK_SECRET e atualiza public.subscriptions via service role.
 * A chave secreta da Stripe nunca é usada aqui — apenas o segredo do webhook,
 * ambos disponíveis somente no servidor.
 */

const TOLERANCE_SECONDS = 300;

async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifyStripeSignature(rawBody: string, header: string | null, secret: string): Promise<boolean> {
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((kv) => {
      const idx = kv.indexOf("=");
      return [kv.slice(0, idx), kv.slice(idx + 1)];
    }),
  );
  const timestamp = parts["t"];
  const signatures = header
    .split(",")
    .filter((kv) => kv.startsWith("v1="))
    .map((kv) => kv.slice(3));
  if (!timestamp || signatures.length === 0) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > TOLERANCE_SECONDS) return false;

  const expected = await hmacSha256Hex(secret, `${timestamp}.${rawBody}`);
  return signatures.some((sig) => timingSafeEqual(sig, expected));
}

interface StripeEvent {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
}

function subStatusFromStripe(status: string | undefined): string {
  switch (status) {
    case "active":
    case "trialing":
      return status;
    case "past_due":
    case "unpaid":
      return "past_due";
    case "canceled":
      return "canceled";
    case "incomplete":
    case "incomplete_expired":
    default:
      return "incomplete";
  }
}

export const Route = createFileRoute("/api/public/stripe-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const webhookSecret = process.env["STRIPE_WEBHOOK_SECRET"];
        if (!webhookSecret) {
          console.error("STRIPE_WEBHOOK_SECRET não configurado");
          return new Response("Configuração ausente", { status: 500 });
        }

        // Corpo bruto é obrigatório para validar a assinatura.
        const rawBody = await request.text();
        const valid = await verifyStripeSignature(rawBody, request.headers.get("stripe-signature"), webhookSecret);
        if (!valid) return new Response("Assinatura inválida", { status: 401 });

        let event: StripeEvent;
        try {
          event = JSON.parse(rawBody) as StripeEvent;
        } catch {
          return new Response("Payload inválido", { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        type SubFields = {
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          plan?: string | null;
          status?: string;
          current_period_end?: string | null;
          cancel_at_period_end?: boolean;
        };

        const upsertByUser = async (fields: SubFields, userId?: string | null, customerId?: string | null) => {
          if (userId) {
            const { error } = await supabaseAdmin
              .from("subscriptions")
              .upsert({ user_id: userId, ...fields }, { onConflict: "user_id" });
            if (error) console.error("Falha ao gravar assinatura:", error.message);
            return;
          }
          if (customerId) {
            // Sem user_id: localiza pelo stripe_customer_id já gravado.
            const { error } = await supabaseAdmin
              .from("subscriptions")
              .update(fields)
              .eq("stripe_customer_id", customerId);
            if (error) console.error("Falha ao atualizar assinatura:", error.message);
          }
        };

        switch (event.type) {
          case "checkout.session.completed": {
            const session = event.data.object;
            const userId = (session["metadata"] as Record<string, string> | undefined)?.["user_id"] ?? null;
            const customerId = (session["customer"] as string | null) ?? null;
            const subscriptionId = (session["subscription"] as string | null) ?? null;
            await upsertByUser(
              {
                stripe_customer_id: customerId,
                stripe_subscription_id: subscriptionId,
                status: "active",
              },
              userId,
              customerId,
            );
            break;
          }
          case "customer.subscription.created":
          case "customer.subscription.updated": {
            const sub = event.data.object;
            const userId = (sub["metadata"] as Record<string, string> | undefined)?.["user_id"] ?? null;
            const customerId = (sub["customer"] as string | null) ?? null;
            const periodEnd = (sub["current_period_end"] as number | undefined) ?? null;
            const priceId =
              ((sub["items"] as { data?: { price?: { id?: string } }[] } | undefined)?.data?.[0]?.price?.id) ?? null;
            await upsertByUser(
              {
                stripe_customer_id: customerId,
                stripe_subscription_id: sub["id"] as string,
                plan: priceId,
                status: subStatusFromStripe(sub["status"] as string | undefined),
                current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
                cancel_at_period_end: Boolean(sub["cancel_at_period_end"]),
              },
              userId,
              customerId,
            );
            break;
          }
          case "customer.subscription.deleted": {
            const sub = event.data.object;
            const customerId = (sub["customer"] as string | null) ?? null;
            await supabaseAdmin
              .from("subscriptions")
              .update({ status: "canceled", cancel_at_period_end: false })
              .eq("stripe_subscription_id", sub["id"] as string);
            void customerId;
            break;
          }
          default:
            // Eventos não tratados são confirmados para a Stripe não reenviar.
            break;
        }

        return Response.json({ received: true });
      },
    },
  },
});
