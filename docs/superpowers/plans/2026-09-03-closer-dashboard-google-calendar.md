# Closer Dashboard and Google Calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a role-specific closer home dashboard centered on upcoming interviews and add a secure Google Calendar connection foundation for free/busy conflict checking and Orbit-owned event creation.

**Architecture:** The existing `/` route remains the role-aware entry point. Admin and BD retain the current operational dashboard; closers receive a server-rendered closer workspace that composes calendar data, pending feedback, assigned tasks, notifications, activity, and availability status. Google Calendar is isolated behind a calendar integration service and database connection record; the first release uses Orbit as the source of truth, reads Google free/busy, and creates/updates Orbit-owned Google events without importing private event details.

**Tech Stack:** Next.js 16 App Router, React client components, NestJS 11, Prisma/PostgreSQL, Zod contracts, Vitest, Playwright, Google OAuth 2.0 and Google Calendar API.

**Spec:** `docs/superpowers/specs/2026-09-03-orbit-crm-completion-design.md`

## Global Constraints

- Frontend runs on port `3100`; backend runs on port `3101`.
- Ports `3000` and `3001` are reserved for other services and must not be used.
- File upload functionality remains deferred from this MVP.
- Orbit remains the source of truth for interviews and scheduling in the first calendar integration release.
- Private Google Calendar event titles/details are never exposed to other CRM users; conflict checks return busy/free only.
- OAuth refresh tokens are encrypted at rest and are never returned by API responses.
- Every mutation creates an activity event and must be safe to retry without duplicate Google events.

### Task 1: Define closer workspace contracts and backend aggregation

**Files:**
- Modify: `packages/contracts/src/analytics.ts` or create `packages/contracts/src/closer-dashboard.ts`
- Modify: `packages/contracts/src/index.ts`
- Create: `packages/backend/src/closer-dashboard/closer-dashboard.service.ts`
- Create: `packages/backend/src/closer-dashboard/closer-dashboard.service.test.ts`
- Create: `apps/api/src/modules/closer-dashboard/closer-dashboard.controller.ts`
- Create: `apps/api/src/modules/closer-dashboard/closer-dashboard.module.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**
- `GET /api/v1/closer-dashboard` returns `{ nextMeeting, todayMeetings, needsFeedback, openTasks, conflicts, notifications, recentActivity, calendarConnection }`.
- `CloserDashboardData` contains only summaries already permitted to the authenticated closer.
- The service filters interviews by `closerId`, tasks by `assigneeId`, notifications by recipient, and activity through the existing visibility rules.

- [ ] Write failing service tests for a closer receiving only assigned interviews/tasks, an empty-state response, pending feedback detection, and disconnected calendar status.
- [ ] Run `../../node_modules/.bin/vitest run packages/backend/src/closer-dashboard/closer-dashboard.service.test.ts` and verify the tests fail because the service and contract do not exist.
- [ ] Implement the Zod response contract and service using existing interview/task/notification/activity mappings; sort meetings by start time and cap dashboard lists to useful limits (next 5 meetings, next 5 tasks, next 10 notifications/activity events).
- [ ] Add the guarded controller and module with explicit NestJS injection, matching the existing API prefix and error envelope.
- [ ] Run the focused service test and the API typecheck; verify all pass.
- [ ] Commit: `feat: add closer dashboard aggregation`

### Task 2: Build the closer dashboard UI

**Files:**
- Create: `apps/web/components/dashboard/closer-dashboard.tsx`
- Create: `apps/web/components/dashboard/closer-dashboard.test.tsx`
- Modify: `apps/web/app/page.tsx`
- Modify: `apps/web/lib/api-client.ts`
- Modify: `apps/web/app/globals.css` only if existing tokens cannot support the layout

**Interfaces:**
- `getCloserDashboard(cookie?: string): Promise<CloserDashboardData>` calls `/closer-dashboard` and validates the response.
- `CloserDashboard({ actor, data, error })` is a client component only where buttons need interaction; server pages pass serializable props and never pass callbacks into client components.

- [ ] Write failing UI tests for the calendar-first hierarchy, next-meeting briefing, feedback queue, Google connection state, and empty states.
- [ ] Run the focused frontend tests and verify failure before implementation.
- [ ] Implement the layout from the approved mockup: greeting/header, KPI row, dominant agenda/week list, next-meeting candidate briefing, action queue, recent activity, notifications, and calendar connection card.
- [ ] Add closer-only role branching in `app/page.tsx`; preserve existing Admin/BD dashboard behavior.
- [ ] Add client actions that use internal `window.location.reload()` or router refresh inside client components, never server-passed event handlers.
- [ ] Run frontend tests, typecheck, and lint; verify a closer sees the closer dashboard and admin/BD do not.
- [ ] Commit: `feat: add closer calendar-first dashboard`

### Task 3: Add Google Calendar connection persistence and OAuth boundaries

**Files:**
- Modify: `packages/database/prisma/schema.prisma`
- Create: `packages/database/prisma/migrations/20260903100000_google_calendar_connections/migration.sql`
- Modify: `packages/contracts/src/users.ts` or create `packages/contracts/src/calendar.ts`
- Create: `packages/backend/src/calendar/google-calendar.service.ts`
- Create: `packages/backend/src/calendar/google-calendar.service.test.ts`
- Create: `apps/api/src/modules/calendar/calendar.controller.ts`
- Create: `apps/api/src/modules/calendar/calendar.module.ts`
- Modify: `apps/api/src/app.module.ts`
- Modify: `packages/config/src/index.ts`

**Interfaces:**
- `GoogleCalendarConnection`: user ID, provider, Google account email, selected calendar ID/name, encrypted refresh token, scopes, last sync timestamp, status, created/updated timestamps.
- `GET /api/v1/calendar/google/connect` returns an authorization URL only to the authenticated closer.
- `GET /api/v1/calendar/google/callback` validates state, exchanges the code, encrypts the refresh token, and redirects to the frontend settings result.
- `GET /api/v1/calendar/google/status` returns `{ connected, email, calendarName, lastSyncedAt, status }` without secrets.
- `DELETE /api/v1/calendar/google` disconnects the closer account and removes stored token material.

- [ ] Write failing tests for OAuth state validation, closer-only access, token redaction, disconnect behavior, and unavailable credentials producing a clear configuration error.
- [ ] Run focused tests and verify they fail before implementation.
- [ ] Add the Prisma model and migration with a unique user/provider constraint and encrypted token column.
- [ ] Add config variables `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI`, and an encryption key; fail closed when absent.
- [ ] Implement OAuth state tied to the authenticated session, authorization-code exchange, token encryption/decryption, and status/disconnect endpoints.
- [ ] Run migration against the local database, focused tests, API typecheck, and lint.
- [ ] Commit: `feat: add google calendar connection foundation`

### Task 4: Add free/busy checking and Orbit-owned event synchronization

**Files:**
- Modify: `packages/contracts/src/interviews.ts`
- Modify: `packages/database/prisma/schema.prisma`
- Create: `packages/database/prisma/migrations/20260903110000_google_event_links/migration.sql`
- Modify: `packages/backend/src/calendar/google-calendar.service.ts`
- Modify: `packages/backend/src/interviews/interviews.service.ts`
- Modify: `apps/api/src/modules/calendar/calendar.controller.ts`
- Create: `packages/backend/src/calendar/google-calendar.integration.test.ts`

**Interfaces:**
- `checkGoogleBusyFree(actor, startsAt, endsAt): Promise<{ busy: boolean }>`.
- `syncInterviewToGoogle(actor, interview): Promise<{ externalEventId: string }>`.
- Interview rows store provider/event ID and last sync status so retries update the same event.
- Interview create/reschedule/cancel flows call synchronization after the database mutation and record sync failures as visible activity/status, without rolling back the Orbit interview.

- [ ] Write failing integration tests with a mocked Google Calendar client for conflict detection, create, reschedule, cancellation, and idempotent retry.
- [ ] Run the focused integration tests and verify failure before implementation.
- [ ] Implement free/busy queries and event payloads containing candidate/company/role, meeting link, timezone, and preparation summary appropriate for the connected closer.
- [ ] Add conflict reporting to interview scheduling while preserving existing Orbit conflict checks.
- [ ] Add retry-safe event upsert logic keyed by the stored external event ID.
- [ ] Run backend tests, typecheck, lint, and API contract validation.
- [ ] Commit: `feat: sync interviews with google calendar`

### Task 5: Add Google Calendar UI and end-to-end verification

**Files:**
- Create: `apps/web/components/calendar/google-calendar-connection.tsx`
- Create: `apps/web/components/calendar/google-calendar-connection.test.tsx`
- Modify: `apps/web/components/dashboard/closer-dashboard.tsx`
- Modify: `apps/web/app/availability/page.tsx` or the closer settings surface
- Modify: `apps/web/lib/api-client.ts`
- Create: `apps/web/e2e/closer-dashboard.spec.ts`
- Create: `apps/web/e2e/google-calendar.spec.ts`

**Interfaces:**
- The closer sees `Connect Google Calendar`, `Connected`, `Syncing`, `Permission expired`, or `Disconnected` states.
- The UI links to Google authorization, shows selected calendar and last sync time, and provides disconnect.
- E2E tests use a mocked OAuth/calendar provider when credentials are unavailable; real Google OAuth is a manual acceptance step requiring user credentials.

- [ ] Write failing component tests for disconnected/connected/error states and dashboard rendering with calendar status.
- [ ] Run focused frontend tests and verify failure before implementation.
- [ ] Implement connection status card and dashboard badge with accessible labels and clear error copy.
- [ ] Add Playwright coverage for admin/BD dashboard preservation, closer dashboard rendering, interview agenda visibility, feedback action visibility, and mocked connect/disconnect states.
- [ ] Run Playwright against frontend `3100` and backend `3101`; verify no use of `3000` or `3001`.
- [ ] Run full backend tests, frontend tests, typechecks, lint, and `git diff --check`.
- [ ] Commit: `test: verify closer dashboard and calendar flows`

## External Input Required

Implementation can begin and the dashboard can be completed without external input. Google Calendar’s real OAuth flow requires:

1. A Google Cloud project with Google Calendar API enabled.
2. OAuth web-client credentials.
3. The local redirect URI, which will be documented after the API route is added.
4. Confirmation that each closer connects their own Google account and Orbit remains the scheduling source of truth.

Until those are supplied, the local UI will use mocked connection states and the integration will remain safely disconnected.
