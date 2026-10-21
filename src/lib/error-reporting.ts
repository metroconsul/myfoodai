/** Local diagnostics, independent of any editor or telemetry provider. */
export function reportRuntimeError(error: unknown, context: Record<string, unknown> = {}) {
  console.error("[MyFoodAI]", error, context);
}
