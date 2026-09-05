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

## Review-fix follow-up

- The Upcoming Interviews **Edit** action now consumes `?edit=<interviewId>` and opens that exact round in edit mode.
- **Open calendar** now carries the interview date through the calendar route and anchors the workspace to that day.
- The BD dashboard shell is independent of performance and drill-down reads. It stays usable when those reads fail and explicitly labels unavailable performance/work-queue data.
- Recruiter response, active application, follow-up, and platform counts now come from the server-owned `GET /performance/me/work-queue` aggregate rather than bounded dashboard previews.

## Follow-up verification

- 16 focused web tests across the dashboard, root route, interview route, calendar route, API client, and selected-date workspace interaction.
- 16 contracts tests, 44 backend performance-service tests (including high-volume queue totals), and 13 API controller tests.
- Typechecks passed for contracts, backend, API, and web; web lint and Prisma schema validation passed.
- `git diff --check` passed.

The targeted selected-date calendar regression passed. The wider calendar-workspace suite retains unrelated date-sensitive expectations from the in-progress calendar visual redesign and was intentionally left unchanged.

## Review-fix: selected calendar date in the configured week view

- Kept the calendar's configured default view as **week** for this committed Task 7 surface.
- Corrected the selected-date regression to verify the intended behavior: `?date=2026-09-08T09:00:00.000Z` opens the exact week containing September 8 and renders the Tuesday column, rather than incorrectly requiring a day-view title.
- The route-to-workspace `initialDate` contract and BD quick action remain unchanged.
- Fresh validation: 102 web tests, web typecheck, web lint, and `git diff --check` pass.
