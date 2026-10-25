import { createHash, timingSafeEqual } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";
import { isAuthorizedAutomationRequest } from "@/lib/automation.server";
import { mpSyncCronSecret, syncAllConnections } from "@/lib/mercado-pago.server";

const digest = (v: string) => createHash("sha256").update(v, "utf8").digest();

/** Chamado pelo agendador do banco (pg_cron) a cada 2 minutos, ou pela automação com o token. */
async function authorized(request: Request) {
  if (isAuthorizedAutomationRequest(request)) return true;
  const auth = request.headers.get("authorization") ?? "";
  const received = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const expected = received ? await mpSyncCronSecret() : null;
  return Boolean(expected && timingSafeEqual(digest(received), digest(expected)));
}

export const Route = createFileRoute("/api/automation/mercado-pago-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!(await authorized(request))) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
        const results = await syncAllConnections();
        return Response.json({ ok: true, connections: results.length, failed: results.filter((r) => r.error).length });
      },
    },
  },
});
