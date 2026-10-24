import { createFileRoute } from "@tanstack/react-router";

type Notification = {
  type?: string;
  topic?: string;
  action?: string;
  user_id?: number | string;
  data?: { id?: number | string };
};

/**
 * Avisos do Mercado Pago (configurados uma vez no aplicativo da MyFoods).
 * - payment: busca o pagamento com o token da conta e grava a venda.
 * - mp-connect (application.deauthorized): o dono desvinculou no Mercado Pago; apaga os tokens.
 * Assinatura HMAC conferida em todo aviso. Responde 200 para o que não interessa, senão o MP reenvia.
 */
export const Route = createFileRoute("/api/public/mercado-pago/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        let body: Notification;
        try {
          body = (await request.json()) as Notification;
        } catch {
          return new Response("Payload inválido", { status: 400 });
        }
        const dataId = url.searchParams.get("data.id") ?? (body.data?.id != null ? String(body.data.id) : null);

        const srv = await import("@/lib/mercado-pago.server");
        const valid = srv.verifyWebhookSignature({
          header: request.headers.get("x-signature"),
          requestId: request.headers.get("x-request-id"),
          dataId,
        });
        if (!valid) return new Response("Assinatura inválida", { status: 401 });

        const type = body.type ?? body.topic ?? url.searchParams.get("type");
        const userId = body.user_id != null ? String(body.user_id) : null;
        if (!userId) return Response.json({ ok: true, ignored: true });

        if (type === "payment" && dataId) {
          try {
            return Response.json({ ok: true, ...(await srv.ingestPaymentNotification(userId, dataId)) });
          } catch {
            // 500 faz o Mercado Pago tentar de novo mais tarde.
            return new Response("Falha ao processar", { status: 500 });
          }
        }

        if (type === "mp-connect" && body.action === "application.deauthorized") {
          const conn = await srv.connectionByProviderUser(userId);
          if (conn) await srv.disconnect(conn.id);
          return Response.json({ ok: true });
        }

        return Response.json({ ok: true, ignored: true });
      },
    },
  },
});
