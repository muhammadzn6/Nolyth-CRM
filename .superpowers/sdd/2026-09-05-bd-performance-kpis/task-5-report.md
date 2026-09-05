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

## Review-fix follow-up

The Task 5 review findings are resolved without changing Task 6 calendar work.

- Future holidays and approved leave/reduced-schedule records now have version-aware edit and delete controls. The UI passes the record version to the existing mutation routes and displays the API's historical-protection message when a started record cannot be rewritten.
- `GET /performance/rules/history` is Admin-protected and returns the existing immutable rule versions ordered by effective date. The rules workspace renders the effective range, version, editor identity, and audit context.
- Bounded numeric and timezone fields now expose maximum constraints, `aria-invalid`, linked error text, and field-specific validation feedback.

### Review-fix regression evidence

Initial RED checks established the missing API history helper, missing future-record controls/history UI, and missing backend history route. Final verification:

- `npm --prefix apps/web test -- --run lib/performance-api-client.test.ts components/performance/performance-rules-form.test.tsx` — 11 passed.
- `npm --prefix packages/backend test -- --run src/performance/performance.service.test.ts` — 42 passed.
- `npm --prefix apps/api test -- --run src/modules/performance/performance.controller.test.ts` — 11 passed.
- `npm --prefix apps/web run typecheck`, `npm --prefix packages/backend run typecheck`, and `npm --prefix apps/api run typecheck` — passed.
- `npm run db:validate` — passed.
- Isolated Task 5 diff check — passed.

## Controller-route repair

The follow-up review found that `GET /performance/rules/history` had been accidentally inserted inside `previewRules`, leaving the controller syntactically invalid. The repair restores it as an independent class route immediately after `GET /performance/rules` and preserves the existing immutable `performanceRuleSchema[]` response contract.

### Regression evidence

- RED: the controller source from commit `1aff133` produces TypeScript parser errors (`Declaration expected`, `Expression expected`, and related parse errors).
- GREEN: `npm --prefix apps/api test -- --run src/modules/performance/performance.controller.test.ts` — 11 passed.
- The focused controller regression invokes both `ruleHistory` and `previewRules`, proving the independent history read and preview routes continue to work together.

## Final review correction

- The editable rule read now returns the latest open version (`effectiveTo: null`), which is the scheduled future version when one exists. The UI consequently reloads that version and uses its id/version when an Admin schedules its replacement.
- Added service and form regressions for the refresh → select scheduled rule → schedule another future rule path.
- Corrected the reassignment-queue controller test so it is a sibling of the duplicate-review test and independently checks both queue statuses.

### Final correction verification

- Backend performance service test: 43 passed.
- API performance controller test: 12 passed.
- Focused rules UI test suite: passed with the Task 6 dashboard checks.
