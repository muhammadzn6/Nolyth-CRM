# Task 8 — final review-fix package

**Review range:** `506cccb..7e91635`

## Scope

This follow-up resolves every Important finding in `task-8-review-report-final.md` without touching the unrelated calendar, dashboard, or intake work in the working tree.

## Review targets

1. `pnpm db:seed:demo` must reject an arbitrary/shared-style `DATABASE_URL` before any Prisma query or mutation.
2. The default allowlist must be exactly `orbit_task3_test` and `orbit_e2e`.
3. `ORBIT_ALLOW_DEMO_SEED=true` may bypass that name allowlist only outside `NODE_ENV=production`; production must reject both the override and allowlisted names.
4. The BD denial test must cover the Admin page redirect plus `GET /performance/rules/history`, `POST /performance/rules/preview`, and `PATCH /performance/rules` with an authenticated browser-context API client. Each endpoint must return `403` and expose neither rule configuration nor KPI data.
5. Browser configuration and documentation must retain local ports `3100`/`3101` only and contain no credentials.

## Changed paths

- `packages/database/src/demo-seed-safety.ts`
- `packages/database/prisma/seed-demo.ts`
- `packages/database/prisma/seed-demo-safety.test.ts`
- `apps/web/e2e/performance-helpers.ts`
- `apps/web/e2e/bd-performance.spec.ts`
- `README.md`
- `task-8-report.md`

## Fresh verification evidence

- Demo-seed safety tests: 4/4 passed.
- Database and web typechecks passed.
- Database and web lint passed.
- Playwright discovery reports 6 tests in the requested 3 specs.
- `git diff --check` passed.

## Live E2E boundary

Live authenticated execution remains intentionally blocked: the shell has no E2E Admin/BD passwords, neither local service is running on `3100`/`3101`, and the shared local database has existing migration-history drift. No database reset, migration, seed, or credential fallback was used for this follow-up.
