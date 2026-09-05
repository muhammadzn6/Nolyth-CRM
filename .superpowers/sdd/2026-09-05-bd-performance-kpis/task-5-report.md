# Task 5 — Admin Performance Rules UI report

## Delivered

- Added typed performance API helpers for rule reads, impact previews, versioned updates, BD targets, holidays, approved leave/reduced schedules, duplicate-review queue reads, and duplicate-review decisions.
- Added the Admin-only `/admin/performance` route and an interactive rules workspace using existing Orbit cards, fields, inputs, and buttons.
- Added future-effective rule editing with server preview and an explicit confirmation gate before save.
- Added individual BD target controls, holiday and leave/reduced-schedule controls, active-rule provenance, and the every-pending duplicate override queue with mandatory decision reason.

## TDD evidence

### RED

Command:

```sh
npm --prefix apps/web test -- --run components/performance/performance-rules-form.test.tsx
```

Expected failure observed before the component existed:

```text
Failed to resolve import "./performance-rules-form"
```

The test described the Admin role boundary, rule loading, target/holiday/leave controls, preview confirmation, and mandatory duplicate-review reason before implementation.

### GREEN

Command:

```sh
npm --prefix apps/web test -- --run lib/performance-api-client.test.ts components/performance/performance-rules-form.test.tsx
```

Result: 2 files passed, 8 tests passed.

## Verification

- Focused frontend tests: 8/8 passed.
- `git diff --check`: passed.
- Web typecheck was run. It remains blocked by four pre-existing, out-of-scope uncommitted dashboard/performance errors:
  - missing `PerformanceFollowUpWithLead` export in `components/dashboard/dashboard-overview.tsx`, `components/performance/admin-bd-performance.test.tsx`, and `components/performance/reassignment-queue.tsx`;
  - a mismatched call in `components/performance/admin-performance-page.test.tsx`.
- No Task 5 file appears in the current typecheck failures.

## Files changed

- `apps/web/lib/api-client.ts`
- `apps/web/lib/performance-api-client.test.ts`
- `apps/web/components/performance/performance-rules-form.tsx`
- `apps/web/components/performance/performance-rules-form.test.tsx`
- `apps/web/components/performance/rule-impact-preview.tsx`
- `apps/web/app/admin/performance/page.tsx`

## Self-review

- Successful performance responses are parsed through the shared contracts; unsuccessful responses continue through the shared structured API error path.
- The route redirects unauthenticated or non-Admin users; the client component also prevents loading protected data for a non-Admin actor.
- The UI deliberately renders server-provided impact and policy state rather than calculating target credit or rankings in React.
