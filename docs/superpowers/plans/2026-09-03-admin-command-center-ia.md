# Admin Command Center IA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize the admin experience into focused navigation groups and a command-center dashboard without changing domain permissions.

**Architecture:** Keep the existing Next.js server-rendered routes and AppShell. Add a role-aware grouped sidebar, a client directory entry point, and admin dashboard sections that link to existing operational routes. Preserve existing APIs and use explicit client IDs for client workspace links.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind-style Orbit UI, Vitest.

**Spec:** Existing approved admin information architecture from the conversation.

## Global Constraints

- Frontend runs on port 3100.
- Backend runs on port 3101.
- Do not use ports 3000 or 3001.
- Keep admin-only controls admin-only.
- Do not expose secrets or raw credentials in logs or UI.

### Task 1: Group admin navigation

**Files:**
- Modify: `apps/web/components/layout/app-shell.tsx`
- Modify: `apps/web/components/layout/app-sidebar.tsx`
- Test: `apps/web/components/layout/app-shell.test.tsx`

- [ ] Add a failing test for grouped admin navigation labels and role visibility.
- [ ] Run the focused test and confirm it fails because groups are not represented.
- [ ] Add grouped navigation with Command Center, Recruitment, Clients, Scheduling, Insights, and Administration.
- [ ] Keep client calendar under Clients and keep Users under Administration.
- [ ] Run the focused test and confirm it passes.

### Task 2: Add admin client directory

**Files:**
- Create: `apps/web/app/admin/clients/page.tsx`
- Create: `apps/web/components/clients/client-directory.tsx`
- Modify: `apps/web/app/admin/client-calendars/page.tsx`
- Test: `apps/web/components/clients/client-directory.test.tsx`

- [ ] Add a failing test for rendering client names as workspace links.
- [ ] Run the focused test and confirm it fails.
- [ ] Render the existing company list with workspace, calendar, and assignment status.
- [ ] Link each client to `/admin/clients/:clientId`.
- [ ] Run the focused test and confirm it passes.

### Task 3: Refocus admin dashboard

**Files:**
- Modify: `apps/web/components/dashboard/admin-dashboard.tsx`
- Modify: `apps/web/app/page.tsx`
- Test: `apps/web/components/dashboard/admin-dashboard.test.tsx`

- [ ] Add a failing test for command-center sections: pipeline, schedule, client health, action queue, and activity.
- [ ] Run the focused test and confirm it fails.
- [ ] Add focused sections using existing dashboard data and links.
- [ ] Add explicit client labels to operational summaries where data is available.
- [ ] Run the focused test and confirm it passes.

### Task 4: Verify navigation and live routes

**Files:**
- Test: `apps/web/components/layout/app-shell.test.tsx`, `apps/web/components/clients/client-directory.test.tsx`, `apps/web/components/dashboard/admin-dashboard.test.tsx`

- [ ] Run all focused admin UI tests.
- [ ] Run API and web TypeScript checks.
- [ ] Verify `http://localhost:3100` and `http://localhost:3101/health/live`.
- [ ] Use Playwright with the admin account to verify sidebar groups, client directory, and a client workspace link.
- [ ] Run `git diff --check`.
