# Orbit Frontend Visual System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the approved soft editorial operations design across Orbit while preserving real role workflows and moving data entry into accessible modal dialogs.

**Architecture:** Keep Next App Router pages server-first and pass serializable data into focused client interaction islands. Add shared shell and dialog primitives, then compose role-specific dashboards and browse-first management workspaces from the existing API clients and domain forms.

**Tech Stack:** Next.js 16.3.3 App Router, React 19.2.8, Tailwind CSS 4, Vitest/React DOM test harness, Playwright CLI, existing `@orbit/ui` primitives.

**Spec:** `docs/superpowers/specs/2026-09-06-orbit-frontend-visual-system-design.md`

## Global Constraints

- Keep frontend on `http://localhost:3100` and backend on `http://localhost:3101`; never use ports 3000 or 3001.
- Do not add a giant rounded application canvas around the whole workspace.
- Preserve current API contracts, role authorization, candidate-calendar mapping, and domain behaviour.
- Use server components for data loading and client components only for ephemeral interaction state.
- Do not add dependencies; reuse the existing UI package and SVG/CSS primitives.
- Preserve unrelated uncommitted changes in the current branch.

---

### Task 1: Shared visual foundations and command shell

**Files:**
- Modify: `apps/web/app/globals.css`
- Modify: `packages/ui/src/card.tsx`
- Modify: `packages/ui/src/button.tsx`
- Modify: `packages/ui/src/field.tsx`
- Modify: `apps/web/components/layout/app-shell.tsx`
- Modify: `apps/web/components/layout/app-header.tsx`
- Modify: `apps/web/components/layout/app-sidebar.tsx`
- Modify: `apps/web/components/layout/app-header.test.tsx`
- Modify: `apps/web/components/layout/app-shell-interactions.test.tsx`

**Interfaces:**
- Consumes: `SessionUser`, existing navigation routes, `logout()`.
- Produces: a 72/224px expandable rail, an integrated command header, and role-aware quick-add links using `?new=` route state.

- [ ] **Step 1: Add failing shell tests**

  Assert that mobile page identity is present, Admin/BD/Closer quick-add menus expose only their approved actions, and rail expansion changes 72px/224px layout classes.

- [ ] **Step 2: Verify the shell tests fail for the missing command behaviour**

  Run: `./node_modules/.bin/vitest run apps/web/components/layout/app-header.test.tsx apps/web/components/layout/app-shell-interactions.test.tsx`

- [ ] **Step 3: Implement the shared shell and token changes**

  Keep page identity visible, add an accessible quick-add menu, retain keyboard navigation, and reduce the main content padding to match the compact rail.

- [ ] **Step 4: Verify shell tests and baseline tests pass**

  Run: `./node_modules/.bin/vitest run apps/web/components/layout`

### Task 2: Accessible popup-oriented data entry

**Files:**
- Create: `apps/web/components/ui/dialog.tsx`
- Create: `apps/web/components/ui/dialog.test.tsx`
- Modify: `apps/web/components/dashboard/bd-application-entry.tsx`
- Modify: `apps/web/components/candidates/candidate-list.tsx`
- Modify: `apps/web/components/admin/users-page.tsx`
- Modify: `apps/web/components/candidates/candidate-list.test.tsx`
- Modify: `apps/web/components/admin/users-page.test.tsx`

**Interfaces:**
- Produces: `Dialog({ open, onOpenChange, title, description, children })` with `role="dialog"`, Escape dismissal, labelled title, and scroll locking.
- Consumes: existing `CandidateForm`, `LeadCaptureForm`, and user creation handlers without changing API payloads.

- [ ] **Step 1: Write failing dialog and page-flow tests**

  Test that create forms are absent initially, appear after clicking the primary action, close on Escape/cancel, and remain labelled for assistive technology.

- [ ] **Step 2: Verify the new tests fail**

  Run: `./node_modules/.bin/vitest run apps/web/components/ui/dialog.test.tsx apps/web/components/candidates/candidate-list.test.tsx apps/web/components/admin/users-page.test.tsx`

- [ ] **Step 3: Implement the minimal shared dialog and migrate the three highest-volume entry flows**

  Remove nested cards from dialog bodies, keep validation messages visible, and preserve collection updates after successful creates.

- [ ] **Step 4: Verify popup flows pass**

  Run the same focused Vitest command and confirm zero failures.

### Task 3: Role dashboard hierarchy and honest visual KPIs

**Files:**
- Modify: `apps/web/components/dashboard/dashboard-overview.tsx`
- Modify: `apps/web/components/dashboard/bd-dashboard.tsx`
- Modify: `apps/web/components/dashboard/closer-dashboard.tsx`
- Modify: `apps/web/components/dashboard/bd-calendar-preview.tsx`
- Modify: `apps/web/components/dashboard/dashboard-overview.test.tsx` if present; otherwise `apps/web/components/dashboard/dashboard-kpis.test.ts`
- Modify: `apps/web/components/dashboard/bd-dashboard.test.tsx`
- Modify: `apps/web/components/dashboard/closer-dashboard.test.tsx`

**Interfaces:**
- Consumes: existing `DashboardData`, `BdPerformanceResponse`, `BdWorkQueue`, `CloserDashboardData`, calendar records, and role scopes.
- Produces: Admin calendar/attention-first, BD daily-progress-first, and Closer calendar-first compositions using only supplied data.

- [ ] **Step 1: Add failing hierarchy and honesty tests**

  Assert that the BD dashboard contains one real cadence chart and no implementation-placeholder copy, the Closer calendar appears before summary metrics, and the Admin dashboard omits the employer promo card.

- [ ] **Step 2: Verify the focused dashboard tests fail**

  Run: `./node_modules/.bin/vitest run apps/web/components/dashboard`

- [ ] **Step 3: Refactor dashboard composition**

  Remove duplicate/fake visualizations, reduce repeated helper text, apply asymmetric grids, and keep each KPI or funnel stage linked to its records.

- [ ] **Step 4: Verify all dashboard tests pass**

  Run the focused dashboard suite again.

### Task 4: Browse-first management surfaces

**Files:**
- Create: `apps/web/components/data/page-toolbar.tsx`
- Create: `apps/web/components/data/page-toolbar.test.tsx`
- Modify: `apps/web/app/leads/page.tsx`
- Modify: `apps/web/app/tasks/page.tsx`
- Modify: `apps/web/app/analytics/page.tsx`
- Modify: `apps/web/app/activity/page.tsx`
- Modify: `apps/web/components/candidates/candidate-list.tsx`
- Modify: `apps/web/components/admin/users-page.tsx`

**Interfaces:**
- Produces: `PageToolbar` for title-adjacent search/filter/action controls and consistent primary data surfaces.
- Consumes: existing server data and form/client handlers; no API contract changes.

- [ ] **Step 1: Add failing toolbar and management-layout tests**

  Assert one toolbar landmark per collection page, no permanently visible create form for candidates/users, and compact structured lists for tasks/activity.

- [ ] **Step 2: Verify the focused tests fail**

  Run: `./node_modules/.bin/vitest run apps/web/components/data apps/web/components/candidates apps/web/components/admin`

- [ ] **Step 3: Implement browse-first layouts**

  Consolidate search/actions, constrain long lists, replace repeated card stacks with rows/tables, and use visual bars/funnel shapes on Analytics.

- [ ] **Step 4: Verify management tests pass**

  Run focused tests followed by the full frontend suite.

### Task 5: Login, responsive behaviour, and visual audit

**Files:**
- Modify: `apps/web/app/login/page.tsx`
- Modify: `apps/web/app/globals.css`
- Modify: `apps/web/e2e/smoke.spec.ts` only if an existing selector must reflect the approved accessible label.

**Interfaces:**
- Consumes: existing login form and session API.
- Produces: readable login contrast, mobile command header identity, drawer navigation, and non-overflowing dashboard layouts.

- [ ] **Step 1: Add or update a failing test for visible login branding and mobile shell controls**
- [ ] **Step 2: Run the focused test and confirm the intended failure**
- [ ] **Step 3: Apply contrast and responsive corrections**
- [ ] **Step 4: Run typecheck, lint, and the production build**

  Run:
  - `./node_modules/.bin/tsc -p apps/web/tsconfig.json --noEmit`
  - `./node_modules/.bin/eslint --config eslint.config.mjs apps/web packages/ui/src`
  - `node scripts/build-web.mjs`

### Task 6: Browser verification for all roles

**Files:**
- Output only: `output/playwright/orbit-redesign-*.png`

**Interfaces:**
- Consumes: live frontend at 3100 and backend at 3101.
- Produces: screenshots and interaction evidence for Admin, BD, and Closer at desktop and mobile widths.

- [ ] **Step 1: Verify both services and the Playwright prerequisite**

  Run: `command -v npx && curl -fsS http://localhost:3100/login && curl -fsS http://localhost:3101/api/v1/health`

- [ ] **Step 2: Audit Admin desktop and mobile**

  Verify login, rail expansion, quick-add menu, dashboard hierarchy, candidates popup, users popup, tasks, analytics, activity, and logout.

- [ ] **Step 3: Audit BD desktop and mobile**

  Verify daily tracker, cadence, actionable queue, application popup, fixed-size calendar/recent lists, and role-scoped navigation.

- [ ] **Step 4: Audit Closer desktop and mobile**

  Verify calendar-first order, event opening, assigned applications, outcome actions, and role-scoped navigation.

- [ ] **Step 5: Inspect browser console and network state**

  Reject uncaught application errors, hydration failures caused by Orbit code, or failed same-origin API requests. Browser-extension DOM attributes are documented separately and are not treated as Orbit failures.

- [ ] **Step 6: Run the full frontend regression suite again**

  Run: `./node_modules/.bin/vitest run apps/web`
