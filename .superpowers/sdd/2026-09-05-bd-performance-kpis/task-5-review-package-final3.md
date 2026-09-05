# Task 5 final correction review package

## Scope

Focused correction for `task-5-review-report-final2.md`. It covers only effective-dated rule selection after a page reload, the controller-test nesting repair shared with Task 6, and the dashboard-page contract alignment. Calendar visuals are excluded.

## Required checks

- Confirm `getPerformanceRules` returns the latest open rule, including a scheduled future rule.
- Confirm the rules form reloads that rule and submits its id/version when scheduling its successor.
- Confirm the duplicate-review and reassignment-queue controller tests execute as independent sibling tests.
- Confirm `apps/web/app/page.tsx` passes only props accepted by the committed `DashboardOverview` contract, plus the scoped reassignment error prop introduced by this fix.

## Regression commands

- `npm --prefix packages/backend test -- --run src/performance/performance.service.test.ts`
- `npm --prefix apps/api test -- --run src/modules/performance/performance.controller.test.ts`
- `npm --prefix apps/web test -- --run components/performance/performance-rules-form.test.tsx components/performance/admin-performance-page.test.tsx`
- `npm --prefix apps/web run typecheck`
