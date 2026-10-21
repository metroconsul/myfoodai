import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { managerSummaries } from "@/lib/automation.server";
import { unauthorized } from "./-helpers";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional();

export const Route = createFileRoute("/api/automation/manager-summary")({
  server: { handlers: { GET: async ({ request }) => {
    const denied = unauthorized(request); if (denied) return denied;
    const parsed = dateSchema.safeParse(new URL(request.url).searchParams.get("date") ?? undefined);
    if (!parsed.success) return Response.json({ error: "invalid_date" }, { status: 400 });
    return Response.json({ summaries: await managerSummaries(parsed.data) });
  } } },
});
