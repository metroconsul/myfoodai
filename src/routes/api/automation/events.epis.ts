import { createFileRoute } from "@tanstack/react-router";
import { automationEventSchema, parseAutomationJson, processAutomationEvent } from "@/lib/automation.server";
import { resultResponse, unauthorized } from "./-helpers";

export const Route = createFileRoute("/api/automation/events/epis")({
  server: { handlers: { POST: async ({ request }) => {
    const denied = unauthorized(request); if (denied) return denied;
    const parsed = await parseAutomationJson(request, automationEventSchema);
    if ("error" in parsed) return Response.json({ ok: false, error: "invalid_event", details: parsed.error }, { status: 400 });
    return resultResponse(await processAutomationEvent(parsed.data, "epis"));
  } } },
});
