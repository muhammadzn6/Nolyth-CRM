# Orbit Placement Journey Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repair the audited Admin, BD, and Closer placement journey so dates, lifecycle transitions, role navigation, collaboration records, modal mutations, and dashboard counts remain correct from application intake through placement.

**Architecture:** Keep the existing Next.js, NestJS, Prisma, and shared-contract architecture. Add one frontend-only IANA wall-clock conversion module, enforce lifecycle invariants in backend domain services, and make server-rendered lead workspaces refresh through small client mutation controls rather than full-page reloads. Reuse current database fields and activity records; no migration or provider synchronization is introduced.

**Tech Stack:** TypeScript 5.9, Next.js 16.3 App Router, React 19, NestJS, Prisma/PostgreSQL, Zod contracts, Vitest/Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-08-placement-journey-repair-design.md`

## Global Constraints

- Frontend remains on `http://localhost:3100`; backend remains on `http://localhost:3101`; never bind to ports 3000 or 3001.
- Preserve all unrelated dirty-worktree edits. Stage only newly created files or verified task-specific hunks; do not commit a pre-existing user change accidentally.
- Read `apps/web/node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-router.md` before replacing reloads with `router.refresh()`.
- Store instants in UTC; interpret interview wall-clock values in the candidate profile IANA timezone and offer deadlines in the acting user IANA timezone.
- Do not add a datetime dependency or database migration.
- Do not add email synchronization, background ingestion, provider-grade thread identifiers, or a new calendar provider.
- Backend authorization and lifecycle validation remain the source of truth.
- Existing `COMPLETED` interview records remain readable; new attendance actions use the approved forward lifecycle.

---

### Task 1: IANA Wall-Clock Conversion Boundary

**Files:**
- Create: `apps/web/lib/zoned-date-time.ts`
- Create: `apps/web/lib/zoned-date-time.test.ts`

**Interfaces:**
- Produces: `zonedLocalDateTimeToIso(value: string, timeZone: string): string`
- Produces: `isoToZonedLocalDateTime(value: string, timeZone: string): string`
- Throws: `ZonedDateTimeError` with a user-readable message for invalid zones, malformed values, nonexistent local times, or ambiguous local times.

- [ ] **Step 1: Write failing conversion tests**

```ts
import { describe, expect, it } from "vitest";
import { isoToZonedLocalDateTime, zonedLocalDateTimeToIso } from "./zoned-date-time";

describe("zoned local datetime conversion", () => {
  it("interprets New York wall time independently of the browser timezone", () => {
    expect(zonedLocalDateTimeToIso("2026-09-08T10:00", "America/New_York"))
      .toBe("2026-09-08T14:00:00.000Z");
  });

  it("round-trips a stored instant into its interview timezone", () => {
    expect(isoToZonedLocalDateTime("2026-09-08T14:00:00.000Z", "America/New_York"))
      .toBe("2026-09-08T10:00");
  });

  it("rejects nonexistent DST wall time", () => {
    expect(() => zonedLocalDateTimeToIso("2026-03-08T02:30", "America/New_York"))
      .toThrow("does not exist");
  });

  it("rejects ambiguous DST wall time", () => {
    expect(() => zonedLocalDateTimeToIso("2026-11-01T01:30", "America/New_York"))
      .toThrow("ambiguous");
  });
});
```

- [ ] **Step 2: Run the focused test and confirm red**

Run: `pnpm --filter @orbit/web test -- apps/web/lib/zoned-date-time.test.ts`

Expected: FAIL because `./zoned-date-time` does not exist.

- [ ] **Step 3: Implement the minimal conversion module**

Parse `YYYY-MM-DDTHH:mm` manually, validate the IANA zone with `Intl.DateTimeFormat`, derive candidate offsets with `formatToParts`, and accept exactly one UTC instant whose formatted zone parts match the requested wall clock. Reject zero matches as nonexistent and multiple matches as ambiguous. Format stored ISO values with `hourCycle: "h23"` and return a zero-padded `datetime-local` value.

```ts
export class ZonedDateTimeError extends Error {}

export function zonedLocalDateTimeToIso(value: string, timeZone: string): string;
export function isoToZonedLocalDateTime(value: string, timeZone: string): string;
```

- [ ] **Step 4: Run the focused test and confirm green**

Run: `pnpm --filter @orbit/web test -- apps/web/lib/zoned-date-time.test.ts`

Expected: PASS for New York, Karachi, invalid-zone, DST-gap, DST-fold, and round-trip cases.

- [ ] **Step 5: Record a safe checkpoint**

Run: `git diff --check -- apps/web/lib/zoned-date-time.ts apps/web/lib/zoned-date-time.test.ts`

If both files are new and isolated, commit with `git add apps/web/lib/zoned-date-time.ts apps/web/lib/zoned-date-time.test.ts && git commit -m "fix: add timezone-safe wall clock conversion"`. Otherwise leave them unstaged and preserve the user-owned dirty state.

### Task 2: Interview and Offer Form Datetime Correctness

**Files:**
- Modify: `apps/web/components/interviews/interview-form.tsx`
- Modify: `apps/web/components/interviews/interview-edit-form.tsx`
- Modify: `apps/web/components/calendar/calendar-workspace.tsx`
- Modify: `apps/web/components/offers/offer-form.tsx`
- Modify: `apps/web/app/leads/[leadId]/interviews/page.tsx`
- Modify: `apps/web/app/leads/[leadId]/[section]/page.tsx`
- Test: `apps/web/components/interviews/interview-edit-form.test.tsx`
- Test: `apps/web/components/calendar/calendar-workspace.test.tsx`
- Create: `apps/web/components/interviews/interview-form.test.tsx`
- Create: `apps/web/components/offers/offer-form.test.tsx`

**Interfaces:**
- Consumes: Task 1 conversion functions.
- Changes: `InterviewForm({ leadId, closers, timezone, onSuccess?, embedded? })`.
- Changes: `OfferForm({ leadId, offer?, timezone, onSuccess?, embedded? })`.
- Preserves: existing API payloads continue to contain UTC ISO strings and the interview IANA `timezone`.

- [ ] **Step 1: Write failing component tests**

```tsx
it("submits a New York wall time as the matching UTC instant", async () => {
  render(<InterviewForm leadId={leadId} closers={[closer]} timezone="America/New_York" />);
  await user.type(screen.getByLabelText("Starts"), "2026-09-08T10:00");
  await user.type(screen.getByLabelText("Ends"), "2026-09-08T11:00");
  await user.click(screen.getByRole("button", { name: "Schedule interview" }));
  expect(createLeadInterview).toHaveBeenCalledWith(leadId, expect.objectContaining({
    startsAt: "2026-09-08T14:00:00.000Z",
    endsAt: "2026-09-08T15:00:00.000Z",
    timezone: "America/New_York",
  }));
});

it("renders an offer deadline in the acting user's timezone", () => {
  render(<OfferForm leadId={leadId} offer={offerAt1400Z} timezone="America/New_York" />);
  expect(screen.getByLabelText("Decision deadline (optional)")).toHaveValue("2026-09-08T10:00");
});
```

Add an edit-form assertion that a stored `14:00Z` interview renders as `10:00` in New York, and a calendar-scheduling assertion that the calendar modal uses the lead profile timezone.

- [ ] **Step 2: Run focused form tests and confirm red**

Run: `pnpm --filter @orbit/web test -- apps/web/components/interviews/interview-form.test.tsx apps/web/components/interviews/interview-edit-form.test.tsx apps/web/components/calendar/calendar-workspace.test.tsx apps/web/components/offers/offer-form.test.tsx`

Expected: FAIL because forms currently use browser-local `Date` conversion and raw ISO slicing.

- [ ] **Step 3: Replace browser-local conversion**

Use `zonedLocalDateTimeToIso` on submit and `isoToZonedLocalDateTime` for initial values. Pass profile timezone from `getProfile(lead.profileId, cookie)` into interview creation and actor timezone into offer creation. Keep the selected interview timezone explicit and show conversion errors in the existing form alert without clearing fields.

- [ ] **Step 4: Run focused form tests and confirm green**

Run the command from Step 2.

Expected: PASS; no submitted instant depends on the machine timezone.

- [ ] **Step 5: Record a safe checkpoint**

Run: `git diff --check -- apps/web/components/interviews apps/web/components/calendar/calendar-workspace.tsx apps/web/components/offers apps/web/app/leads`

Do not commit any pre-existing unrelated page or dashboard changes.

### Task 3: Interview State Machine and Premature Attendance Guard

**Files:**
- Modify: `packages/contracts/src/interviews.ts`
- Modify: `apps/api/src/modules/interviews/interviews.controller.ts`
- Modify: `packages/backend/src/interviews/interviews.service.ts`
- Modify: `apps/web/lib/api-client.ts`
- Create: `packages/backend/src/interviews/interviews.service.test.ts`
- Modify: `apps/web/components/interviews/interview-actions.tsx`
- Create: `apps/web/components/interviews/interview-actions.test.tsx`

**Interfaces:**
- Changes contract: `officialResultSchema = { outcome: "PASSED" | "FAILED"; notes?: string; expectedVersion: number }`.
- Changes service: `officialResult(actor, id, outcome, notes, expectedVersion)`.
- Changes client: `saveOfficialInterviewResult(id, outcome, notes, expectedVersion)`.
- Changes component props: `InterviewActions` receives `startsAt`, `closerNotes`, and `officialResult` in addition to current fields.

- [ ] **Step 1: Write failing backend lifecycle tests**

```ts
it("rejects attendance before the interview starts", async () => {
  const service = buildService({ status: "SCHEDULED", startsAt: new Date("2026-09-08T14:00:00Z") }, "2026-09-08T13:59:59Z");
  await expect(service.attendance(closer, roundId, "ATTENDED", 1))
    .rejects.toThrow("cannot be recorded before the interview starts");
});

it("moves attended rounds to waiting feedback and missed rounds to no show", async () => {
  await attendedService.attendance(closer, roundId, "ATTENDED", 1);
  expect(database.interviewRound.updateMany).toHaveBeenCalledWith(expect.objectContaining({
    data: expect.objectContaining({ status: "WAITING_FEEDBACK" }),
  }));
  await missedService.attendance(closer, roundId, "MISSED", 1);
  expect(database.interviewRound.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({
    data: expect.objectContaining({ status: "NO_SHOW" }),
  }));
});

it("records only passed or failed outcomes from waiting feedback", async () => {
  await service.officialResult(admin, roundId, "PASSED", "Strong technical result", 2);
  expect(database.interviewRound.updateMany).toHaveBeenCalledWith(expect.objectContaining({
    where: expect.objectContaining({ status: "WAITING_FEEDBACK" }),
    data: expect.objectContaining({ status: "PASSED", officialResult: "Strong technical result" }),
  }));
});
```

- [ ] **Step 2: Run backend tests and confirm red**

Run: `pnpm --filter @orbit/backend test -- packages/backend/src/interviews/interviews.service.test.ts`

Expected: FAIL because attendance currently permits future rounds and writes `COMPLETED`, while official results write `WAITING_FEEDBACK`.

- [ ] **Step 3: Implement the approved state transitions**

Validate `row.startsAt <= now()` before attendance. Restrict attendance mutation to `SCHEDULED` and `RESCHEDULE_REQUIRED`; map `ATTENDED` to `WAITING_FEEDBACK`, `MISSED` to `NO_SHOW`, and reject `UNKNOWN` as a completion action. Restrict official result to `WAITING_FEEDBACK`; write `PASSED` or `FAILED`, store optional notes or a concise `Passed`/`Failed` label, increment version, and retain activity events.

- [ ] **Step 4: Write failing frontend action tests**

```tsx
it("prefills saved notes and disables premature attendance", () => {
  render(<InterviewActions actorRole="CLOSER" id={roundId} version={2} status="SCHEDULED"
    startsAt="2099-09-08T14:00:00.000Z" closerNotes="Saved note" officialResult={null} />);
  expect(screen.getByRole("button", { name: "Mark attended" })).toBeDisabled();
});

it("offers passed or failed outcomes after attendance", () => {
  render(<InterviewActions actorRole="BD" id={roundId} version={2} status="WAITING_FEEDBACK"
    startsAt="2026-09-08T14:00:00.000Z" closerNotes="Strong call" officialResult={null} />);
  expect(screen.getByLabelText("Official outcome")).toBeInTheDocument();
});
```

- [ ] **Step 5: Update client and action UI, then run both suites**

Replace the free-text official result with a required `PASSED`/`FAILED` select and optional notes input. Initialize closer notes and outcome notes from stored values. Use `useRouter().refresh()` after successful actions and disable attendance until `Date.now() >= startsAt` while leaving the backend guard authoritative.

Run: `pnpm --filter @orbit/backend test -- packages/backend/src/interviews/interviews.service.test.ts && pnpm --filter @orbit/web test -- apps/web/components/interviews/interview-actions.test.tsx`

Expected: PASS.

- [ ] **Step 6: Record a safe checkpoint**

Run: `git diff --check -- packages/contracts/src/interviews.ts apps/api/src/modules/interviews/interviews.controller.ts packages/backend/src/interviews apps/web/lib/api-client.ts apps/web/components/interviews`

### Task 4: Monotonic Lead Progression From Domain Mutations

**Files:**
- Modify: `packages/backend/src/leads/leads.service.ts`
- Modify: `packages/backend/src/leads/collaboration.service.ts`
- Modify: `packages/backend/src/leads/collaboration.service.test.ts`
- Modify: `packages/backend/src/interviews/interviews.service.ts`
- Modify: `packages/backend/src/interviews/interviews.service.test.ts`
- Modify: `packages/backend/src/offers/offers.service.ts`
- Modify: `packages/backend/src/offers/offers.service.test.ts`

**Interfaces:**
- Produces a focused helper in `leads.service.ts`: `advanceLeadStatus(transaction, actor, lead, nextStatus): Promise<void>`.
- The helper advances only when the current status appears earlier in the approved active progression and writes `leadStatusTransition` plus `activityEvent` in the provided transaction.
- `CLOSED` is never reopened automatically.

- [ ] **Step 1: Write failing mutation tests**

```ts
it("advances an applied lead for inbound recruiter communication", async () => {
  await service.createCommunication(actor, leadId, inboundEmail);
  expect(database.jobLead.updateMany).toHaveBeenCalledWith(expect.objectContaining({
    where: { id: leadId, status: "APPLIED" },
    data: expect.objectContaining({ status: "RESPONSE_RECEIVED" }),
  }));
});

it("advances applied or response leads when an interview is created", async () => {
  await service.create(actor, leadId, interviewInput);
  expect(database.jobLead.updateMany).toHaveBeenCalledWith(expect.objectContaining({
    where: { id: leadId, status: { in: ["APPLIED", "RESPONSE_RECEIVED"] } },
    data: expect.objectContaining({ status: "INTERVIEWING" }),
  }));
});

it("advances any pre-offer active state when an offer is created", async () => {
  await service.create(actor, leadId, offerInput);
  expect(database.jobLead.updateMany).toHaveBeenCalledWith(expect.objectContaining({
    where: { id: leadId, status: { in: ["APPLIED", "RESPONSE_RECEIVED", "INTERVIEWING"] } },
    data: expect.objectContaining({ status: "OFFER_RECEIVED" }),
  }));
});
```

Also assert outbound and internal communications do not advance a lead, and later statuses such as `OFFER_ACCEPTED`, `PLACED`, `STARTED`, and `CLOSED` never regress.

- [ ] **Step 2: Run focused service tests and confirm red**

Run: `pnpm --filter @orbit/backend test -- packages/backend/src/leads/collaboration.service.test.ts packages/backend/src/interviews/interviews.service.test.ts packages/backend/src/offers/offers.service.test.ts`

Expected: FAIL on the missing and incomplete transition paths.

- [ ] **Step 3: Implement transactional progression and audit history**

Use `$transaction` where the service already supports it. For each successful automatic status change, write the lead update, `leadStatusTransition`, and a `lead.status_advanced` activity event containing `{ from, to, trigger }`. If the guarded update count is zero because another mutation already moved the lead farther, do not write a false transition.

- [ ] **Step 4: Run focused tests and confirm green**

Run the command from Step 2.

Expected: PASS with monotonic transitions and one audit record per actual state change.

- [ ] **Step 5: Record a safe checkpoint**

Run: `git diff --check -- packages/backend/src/leads packages/backend/src/interviews packages/backend/src/offers`

### Task 5: Reliable Dialog Mutations and Role-Aware Lead Workspace

**Files:**
- Modify: `apps/web/components/ui/dialog.tsx`
- Create: `apps/web/components/ui/dialog.test.tsx`
- Modify: `apps/web/components/leads/lead-page-actions.tsx`
- Modify: `apps/web/components/leads/lead-capture-form.tsx`
- Modify: `apps/web/components/leads/lead-closer-assignment.tsx`
- Create: `apps/web/components/leads/lead-page-actions.test.tsx`
- Modify: `apps/web/app/leads/[leadId]/page.tsx`
- Create: `apps/web/app/leads/[leadId]/page.test.tsx`
- Modify: `apps/web/app/leads/[leadId]/interviews/page.tsx`
- Modify: `apps/web/app/leads/[leadId]/[section]/page.tsx`

**Interfaces:**
- Adds: `LeadCaptureForm({ ..., onSuccess?(): void })`.
- Dialog portals render only after a client mount effect.
- Lead workspace section links are `Interviews`, `Communications`, `Comments`, `Activity`, plus `Offers` only for `ADMIN` and `BD`.

- [ ] **Step 1: Write failing hydration and mutation tests**

```tsx
it("does not change its initial server and client tree before mount", () => {
  const html = renderToString(<Dialog open title="Create" onOpenChange={() => undefined}>Body</Dialog>);
  expect(html).toBe("");
});

it("closes and refreshes after a successful application", async () => {
  render(<LeadPageActions actor={bd} defaultOpen profiles={[profile]} />);
  await submitValidApplication(user);
  expect(mockRefresh).toHaveBeenCalledOnce();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
```

Add page assertions that nested recruiter data renders the recruiter name/email, Closer does not see Offers, and all roles see Interviews.

- [ ] **Step 2: Run focused UI tests and confirm red**

Run: `pnpm --filter @orbit/web test -- apps/web/components/ui/dialog.test.tsx apps/web/components/leads/lead-page-actions.test.tsx apps/web/app/leads/[leadId]/page.test.tsx`

Expected: FAIL on portal hydration, persistent modal, stale server content, nested contact access, and role links.

- [ ] **Step 3: Implement mounted portals and mutation callbacks**

Track `mounted` in `Dialog` with `useEffect`; render no portal until mounted. In `LeadPageActions`, call `setIntakeOpen(false)`, show a concise success status, and call App Router `refresh()` from `onSuccess`. Apply the same refresh callback pattern to Closer assignment.

- [ ] **Step 4: Repair contact rendering and workspace navigation**

Read each lead contact as `{ contact: ContactSummary; role; isPrimary }`; display `contact.name`, `contact.title`, `contact.email`, role, and primary badge. Build the navigation array from actor role and include `/leads/${lead.id}/interviews` for all authorized roles. Do not render an Offers affordance to Closer.

- [ ] **Step 5: Convert large create surfaces to dialogs**

Keep record lists as the page body. Add compact `Schedule interview`, `Add communication`, `Add comment`, and `Create offer` buttons that open the current forms in `Dialog`. Pass `embedded` and `onSuccess` so a successful mutation closes and refreshes; failures retain the form values and open dialog.

- [ ] **Step 6: Run focused UI tests and confirm green**

Run the command from Step 2 plus `pnpm --filter @orbit/web test -- apps/web/app/leads/[leadId]/interviews/page.test.tsx`.

Expected: PASS with no initial hydration mismatch and no stale assignment/application UI.

- [ ] **Step 7: Record a safe checkpoint**

Run: `git diff --check -- apps/web/components/ui apps/web/components/leads apps/web/app/leads`

### Task 6: Structured Communication Capture and Timeline

**Files:**
- Modify: `apps/web/components/leads/collaboration-form.tsx`
- Modify: `apps/web/components/leads/collaboration-edit-form.tsx`
- Create: `apps/web/components/leads/collaboration-form.test.tsx`
- Create: `apps/web/components/leads/communication-timeline.tsx`
- Create: `apps/web/components/leads/communication-timeline.test.tsx`
- Modify: `apps/web/app/leads/[leadId]/[section]/page.tsx`

**Interfaces:**
- Changes: `CollaborationForm({ leadId, kind, contacts, onSuccess?, embedded? })`.
- Produces: `CommunicationTimeline({ items, contacts, timeZone })`.
- The timeline groups adjacent entries by normalized non-empty subject for presentation only; it does not persist a thread ID.

- [ ] **Step 1: Write failing capture and rendering tests**

```tsx
it("submits communication direction, contact, subject, outcome, body, and occurred time", async () => {
  render(<CollaborationForm leadId={leadId} kind="communications" contacts={[recruiter]} />);
  await user.selectOptions(screen.getByLabelText("Direction"), "INBOUND");
  await user.selectOptions(screen.getByLabelText("Recruiter or contact"), recruiter.id);
  await user.type(screen.getByLabelText("Subject"), " Technical interview ");
  await user.type(screen.getByLabelText("Outcome"), "Interview requested");
  await user.type(screen.getByLabelText("Communication details"), "Recruiter requested availability.");
  await user.click(screen.getByRole("button", { name: "Save communication" }));
  expect(createLeadCommunication).toHaveBeenCalledWith(leadId, expect.objectContaining({
    direction: "INBOUND", contactId: recruiter.id, subject: "Technical interview",
    outcome: "Interview requested", type: "EMAIL",
  }));
});

it("renders complete communication metadata with a localized timestamp", () => {
  render(<CommunicationTimeline items={[communication]} contacts={[recruiter]} timeZone="America/New_York" />);
  expect(screen.getByText("Inbound email")).toBeInTheDocument();
  expect(screen.getByText("Technical interview")).toBeInTheDocument();
  expect(screen.getByText("Interview requested")).toBeInTheDocument();
  expect(screen.getByText(recruiter.name)).toBeInTheDocument();
  expect(screen.queryByText(communication.occurredAt)).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run focused communication tests and confirm red**

Run: `pnpm --filter @orbit/web test -- apps/web/components/leads/collaboration-form.test.tsx apps/web/components/leads/communication-timeline.test.tsx`

Expected: FAIL because direction is hard-coded to internal and metadata is not rendered.

- [ ] **Step 3: Implement the structured form**

For communications, render labeled controls for channel, direction, contact, subject, outcome, body, and occurred time. Default external channels to `OUTBOUND`, note to `INTERNAL`, and occurred time to now; preserve user changes. Submit only contract-supported fields. Comments keep the compact body/visibility form.

- [ ] **Step 4: Implement the timeline**

Sort newest-first, map contact IDs to names, show channel/direction labels, subject, outcome, body, and `Intl.DateTimeFormat` output in the acting user timezone. Use a visually distinct neutral treatment for internal notes. Normalize presentation-group subjects with `trim().replace(/\s+/g, " ").toLowerCase()`.

- [ ] **Step 5: Run focused communication tests and confirm green**

Run the command from Step 2.

Expected: PASS; subjects and supported metadata survive save/render.

- [ ] **Step 6: Record a safe checkpoint**

Run: `git diff --check -- apps/web/components/leads apps/web/app/leads/[leadId]/[section]/page.tsx`

### Task 7: Dashboard KPI Semantic Alignment

**Files:**
- Modify: `packages/backend/src/analytics/analytics.service.ts`
- Modify: `packages/backend/src/analytics/analytics.service.test.ts`
- Modify: `packages/backend/src/closer-dashboard/closer-dashboard.service.ts`
- Modify: `packages/backend/src/closer-dashboard/closer-dashboard.service.test.ts`
- Modify: `apps/web/components/dashboard/dashboard-overview.tsx`
- Modify: `apps/web/components/dashboard/closer-dashboard.tsx`
- Modify: `apps/web/components/dashboard/dashboard-kpis.ts`
- Modify: `apps/web/components/dashboard/dashboard-kpis.test.ts`

**Interfaces:**
- Upcoming interview predicate: future `startsAt` and status in `SCHEDULED | RESCHEDULE_REQUIRED`.
- Lead funnel labels use `Offer-stage leads`; record collections use `Offer records`.
- Cancelled rounds do not enter lead or round totals.

- [ ] **Step 1: Add failing semantic tests**

```ts
it("counts only actionable future interviews as upcoming", async () => {
  const result = await service.overview(admin, range);
  expect(result.upcomingInterviews.map((row) => row.status))
    .toEqual(["SCHEDULED", "RESCHEDULE_REQUIRED"]);
});

it("labels unique offer-stage leads without implying offer rows", () => {
  expect(buildDashboardKpis(data)).toContainEqual(expect.objectContaining({
    label: "Offer-stage leads",
  }));
});
```

Cover `WAITING_FEEDBACK`, `NO_SHOW`, `PASSED`, `FAILED`, `COMPLETED`, and `CANCELLED` exclusions.

- [ ] **Step 2: Run focused KPI tests and confirm red**

Run: `pnpm --filter @orbit/backend test -- packages/backend/src/analytics/analytics.service.test.ts packages/backend/src/closer-dashboard/closer-dashboard.service.test.ts && pnpm --filter @orbit/web test -- apps/web/components/dashboard/dashboard-kpis.test.ts`

Expected: FAIL where future non-actionable rounds or ambiguous offer labels are still included.

- [ ] **Step 3: Implement one shared predicate per service boundary and repair labels**

Filter database queries when possible; otherwise filter mapped rows before counting. Do not change formulas unrelated to interview status. Replace only labels that currently represent unique leads reaching offer stage.

- [ ] **Step 4: Run focused KPI tests and confirm green**

Run the command from Step 2.

Expected: PASS.

- [ ] **Step 5: Review dirty-file overlap before any commit**

These dashboard and analytics files already contain user changes. Inspect `git diff` carefully and do not commit them wholesale. Keep only task-specific hunks in the final handoff.

### Task 8: Full Regression and Browser Journey

**Files:**
- Modify: `apps/web/e2e/bd-interviews.spec.ts`
- Modify: `apps/web/e2e/closer.spec.ts`
- Create: `apps/web/e2e/placement-journey.spec.ts`

**Interfaces:**
- Uses seeded credentials: Admin `admin@orbit.local`, BD `maya.bd@orbit.local`, Closer `noah.closer@orbit.local`.
- Uses backend `http://localhost:3101` and frontend `http://localhost:3100` only.

- [ ] **Step 1: Repair stale selectors without weakening assertions**

Replace the exact `W` view assertion with an accessible-name assertion matching the current Week control, and replace the obsolete `Next 7 days` text assertion with the current date-range control label. Keep role and action assertions intact.

- [ ] **Step 2: Add a fresh end-to-end placement journey**

The test must:

```ts
test("admin, BD, and closer can move one application to placement", async ({ browser, request }) => {
  // Admin creates candidate/profile and grants Maya + Noah access.
  // Maya creates a complete application and records an inbound recruiter email.
  // Maya schedules a past interview at 10:00 America/New_York.
  // Noah sees the application, records attendance, and saves closer notes.
  // Maya records PASSED, creates and accepts the offer, then confirms placement.
  // API reads assert the stored 14:00Z instant and final PLACED lead status.
});
```

Use unique names/URLs per run and API setup only where the UI has no intentional action. Assert dialogs close and refreshed lists show the new data.

- [ ] **Step 3: Run all focused unit suites**

Run: `pnpm test`

Expected: all workspace unit tests pass.

- [ ] **Step 4: Run static verification**

Run: `pnpm lint && pnpm typecheck && pnpm build && pnpm format:check`

Expected: all commands exit 0.

- [ ] **Step 5: Verify service health before browser tests**

Run: `curl -fsS http://localhost:3101/api/v1/health && curl -fsS http://localhost:3100/login`

Expected: backend health response succeeds and frontend login HTML loads. If either service is down, start the existing project commands configured for ports 3100/3101 and re-run health checks.

- [ ] **Step 6: Run the complete Playwright suite**

Run: `pnpm --filter @orbit/web test:e2e`

Expected: all Admin, BD, Closer, calendar, interview, offer, and placement journeys pass with no console errors attributable to Orbit.

- [ ] **Step 7: Inspect final UI states at desktop and narrow widths**

Capture the lead workspace, interview dialog, communication timeline, and role dashboards at 1440×1000 and 390×844. Confirm modal focus/close behavior, no horizontal clipping, readable contact metadata, correct role links, and refreshed records.

- [ ] **Step 8: Final evidence and safe handoff**

Run: `git status --short && git diff --check`

Summarize commands and exact pass counts. List any unrelated pre-existing changes separately. Do not claim completion unless unit tests, typecheck, build, health checks, and Playwright all have fresh passing output.
