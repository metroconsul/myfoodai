import { createFileRoute } from "@tanstack/react-router";
import { dispatchNotification, dispatchSchema, parseAutomationJson } from "@/lib/automation.server";
import { resultResponse, unauthorized } from "./-helpers";

export const Route = createFileRoute("/api/automation/dispatch")({
  server: { handlers: { POST: async ({ request }) => {
    const denied = unauthorized(request); if (denied) return denied;
    const parsed = await parseAutomationJson(request, dispatchSchema);
    if ("error" in parsed) return Response.json({ ok: false, error: "invalid_notification", details: parsed.error }, { status: 400 });
    return resultResponse(await dispatchNotification(parsed.data));
  } } },
});
