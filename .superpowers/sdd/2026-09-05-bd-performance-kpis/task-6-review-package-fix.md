# Task 6 review correction package

## Scope

Focused correction for `task-6-review-report.md`. The dashboard keeps server-authoritative values and adds only the missing guardrails, exact KPI drill-down, and scoped queue failure state. Calendar visuals are excluded.

## Required checks

- Render all seven quality guardrails without incorporating them into the score.
- Link Interviews Scheduled and Interviews Needing Scheduling to distinct exact-record metrics.
- Preserve Admin performance when the reassignment queue read fails and render a recoverable queue-only message.
- Confirm the API queue test is an independent sibling test covering the two allowed statuses.

## Regression commands

- `npm --prefix apps/web test -- --run components/performance/admin-bd-performance.test.tsx components/performance/admin-performance-composition.test.tsx components/performance/admin-performance-page.test.tsx`
- `npm --prefix apps/api test -- --run src/modules/performance/performance.controller.test.ts`
- `npm --prefix apps/web run typecheck`
