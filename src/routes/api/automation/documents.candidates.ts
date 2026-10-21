import { createFileRoute } from "@tanstack/react-router";
import { documentCandidates } from "@/lib/automation.server";
import { unauthorized } from "./-helpers";

export const Route = createFileRoute("/api/automation/documents/candidates")({
  server: { handlers: { GET: async ({ request }) => {
    const denied = unauthorized(request); if (denied) return denied;
    return Response.json({ candidates: await documentCandidates() });
  } } },
});
