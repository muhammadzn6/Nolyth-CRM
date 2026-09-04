# Fast Operations Visual Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the approved Fast operations tool visual system across Orbit while preserving current routes, role permissions, calendar behavior, and data workflows.

**Architecture:** Keep the existing Next.js App Router and shared `@orbit/ui` primitives. Make the redesign through global tokens, shell primitives, and focused page-level layout changes; do not alter API contracts or domain state. Admin and Closer dashboards will share visual primitives but retain role-specific content and priorities.

**Tech Stack:** Next.js, React, TypeScript, Tailwind utility classes, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-03-fast-operations-visual-redesign.md`

## Global Constraints

- Frontend remains on port `3100` and backend remains on port `3101`; ports `3000` and `3001` are not used.
- Preserve existing data contracts, permissions, routes, and mutation behavior.
- No generic motivational copy, redundant KPI mosaics, gradients, or decorative panels without a useful state/action.
- Use `#F3F5F7` background, `#FFFFFF` surfaces, `#172338` primary text, `#687589` secondary text, `#DFE4EA` borders, and `#315DCC` primary actions.
- Statuses remain text-labeled and use pale backgrounds with readable dark text.

### Task 1: Shared visual foundation

**Files:**
- Modify: `apps/web/app/globals.css`
- Modify: `packages/ui/src/card.tsx`
- Modify: `apps/web/components/layout/app-shell.tsx`
- Modify: `apps/web/components/layout/app-header.tsx`
- Modify: `apps/web/components/layout/app-sidebar.tsx`
- Test: existing layout tests under `apps/web/components/layout/`

- [ ] Verify existing layout tests before changes.
- [ ] Update global tokens, surfaces, text colors, focus styles, and typography smoothing to match the spec.
- [ ] Use restrained radius/shadow defaults in shared Card and shell surfaces.
- [ ] Make active navigation visibly selected with blue focus treatment without oversized pills.
- [ ] Run layout tests, web typecheck, and `git diff --check`.

### Task 2: Role-scoped dashboard hierarchy

**Files:**
- Modify: `apps/web/components/dashboard/dashboard-overview.tsx`
- Modify: `apps/web/components/dashboard/closer-dashboard.tsx`
- Test: `apps/web/components/dashboard/closer-dashboard.test.tsx`
- Test: `apps/web/app/page.test.tsx`

- [ ] Add or update failing assertions for Admin all-calendar context and Closer next-action context.
- [ ] Replace redundant dashboard KPI/card mosaics with compact summaries and action queues.
- [ ] Keep the calendar as the dominant dashboard workspace with role-specific scope.
- [ ] Ensure Admin exposes All calendars while Closer remains role-scoped by default.
- [ ] Run focused dashboard tests and typecheck.

### Task 3: Calendar and control density

**Files:**
- Modify: `apps/web/components/calendar/calendar-workspace.tsx`
- Modify: `apps/web/app/calendar/page.tsx`
- Test: `apps/web/components/calendar/calendar-workspace.test.tsx`

- [ ] Verify current calendar behavior tests before changes.
- [ ] Tighten calendar header, filters, view toggles, event colors, and responsive behavior without changing event data behavior.
- [ ] Keep Day, Week, Month, and Agenda controls discoverable and keyboard accessible.
- [ ] Run calendar tests and typecheck.

### Task 4: Operational lists and detail surfaces

**Files:**
- Modify: `apps/web/components/candidates/candidate-list.tsx`
- Modify: `apps/web/components/profiles/profile-workspace.tsx`
- Modify: `apps/web/app/leads/page.tsx`
- Modify: `apps/web/components/clients/client-directory.tsx`
- Modify: `apps/web/app/activity/page.tsx`
- Modify: `apps/web/app/notifications/page.tsx`
- Test: candidate, profile, and relevant page tests already present in `apps/web/`

- [ ] Keep repeated records in tables or compact lists rather than card grids.
- [ ] Use a single compact information band for profile facts and a light tab bar for profile sections.
- [ ] Standardize table headers, hover states, row spacing, status pills, and primary row actions.
- [ ] Keep loading, empty, unauthorized, and error states intact.
- [ ] Run focused component/page tests and typecheck.

### Task 5: Browser verification and handoff

**Files:**
- Modify only if browser verification reveals a regression.
- Artifacts: `.playwright-cli/` screenshots and snapshots.

- [ ] Confirm frontend `3100` and backend `3101` health endpoints.
- [ ] Playwright login as Admin and verify dashboard, All calendars, candidates, profiles, leads, activity, and users.
- [ ] Playwright login as Closer and verify role-scoped dashboard calendar, view controls, next meeting, and follow-through queue.
- [ ] Capture desktop and mobile screenshots for both role dashboards.
- [ ] Run final web typecheck, focused tests, and `git diff --check`.
- [ ] Report any pre-existing full-suite failures separately from redesign verification.
