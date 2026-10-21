# Development

Use Node.js 22.12+ and npm. Run `npm run build` and `npm run typecheck` after code changes.
Preserve UI, routes, tenant isolation and audit records. Never put server secrets in VITE_* variables.
TanStack Start server functions and API routes require a Node server; this is not a static SPA.
Do not edit `src/routeTree.gen.ts` manually. Use forward SQL migrations; do not rewrite applied migrations.
Do not rewrite published Git history.

# Architecture guidance

Before planning or changing any MyFoods feature, read `docs/MYFOODS_ARCHITECTURE.md` and the documentation specific to the affected product. Treat it as the approved strategic direction: make small, reversible changes; preserve working flows and data; do not apply remote migrations or other production-impacting changes without an approved plan.
