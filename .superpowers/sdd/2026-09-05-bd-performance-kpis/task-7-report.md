# Task 7 — BD Dashboard Performance Surfaces

## Delivered

- Added the focused BD dashboard at `apps/web/components/dashboard/bd-dashboard.tsx`.
- Added a privacy-safe peer ranking that renders only name, qualified application count, Record Health Rate, Audit Pass Rate, and Duplicate Rate.
- Added a self-only performance and quality panel with score coverage, baseline/insufficient-data states, warnings, current target, and next target effective date.
- Wired the dashboard route to fetch `BdPerformanceResponse` for rolling 30 days and today, and to use the existing server-authorized `/performance/me/drilldown` endpoint for personal records only.
- Added interview quick actions: Edit, Open application, and Open calendar.

## TDD evidence

The new dashboard test was added before the implementation. The initial run failed because `bd-dashboard` did not exist. A later RED cycle added the personal detail link expectation, which failed until the self-only drill-down entry point was added.

## Scope and privacy

- Admin dashboard composition and calendar files were not changed.
- Peer rows render no lead/application links, recruiter details, audit reasons, correction history, or score-details link.
- Drill-down rendering is only reached through the signed-in BD `/performance/me/drilldown` route.

## Verification

- `npm --prefix apps/web test -- components/dashboard/bd-dashboard.test.tsx components/performance/admin-bd-performance.test.tsx apps/web/app/page.test.tsx`
- `npm --prefix apps/web run typecheck`
- `npm --prefix apps/web run lint`
- `git diff --check`

All listed commands passed before commit.
