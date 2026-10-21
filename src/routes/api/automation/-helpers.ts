import { isAuthorizedAutomationRequest } from "@/lib/automation.server";

export function unauthorized(request: Request) {
  return isAuthorizedAutomationRequest(request)
    ? null
    : Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
}

export function resultResponse(result: { status: number; [key: string]: unknown }) {
  const { status, ...body } = result;
  return Response.json(body, { status });
}
