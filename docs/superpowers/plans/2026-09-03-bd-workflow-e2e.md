# BD Workflow E2E Verification Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verify the real BD recruiter workflow end-to-end, including interview scheduling, interview updates, cancellation, collaboration records, offers, tasks, and role boundaries.

**Architecture:** Extend the existing Playwright suite with a BD-authenticated flow using the seeded Maya account and stable demo application. Exercise mutations through the real frontend and restore or use isolated records where mutation changes shared state. Keep authorization decisions in the backend and expose only role-appropriate controls in the frontend.

**Tech Stack:** Next.js 16, React, NestJS, Prisma, Playwright, TypeScript.

**Spec:** `docs/superpowers/plans/2026-09-03-admin-mvp-completion.md`

## Global Constraints

- Frontend runs on port 3100.
- Backend runs on port 3101.
- Candidate Google Calendars are the calendar owner; BD does not need a Google account.
- BD may mutate records only for profiles/applications assigned to that BD.
- Closers own attendance and closer notes; BD owns recruiter-side interview scheduling and updates.
- File upload functionality remains deferred.

---

### Task 1: BD interview workflow

**Files:**
- Modify: `apps/web/e2e/bd-interviews.spec.ts`
- Modify: `apps/web/app/leads/[leadId]/interviews/page.tsx`
- Modify: `apps/web/components/interviews/interview-edit-form.tsx`
- Modify: `apps/web/components/interviews/interview-actions.tsx`
- Modify: `apps/web/app/calendar/page.tsx`

- [ ] Add failing browser assertions for BD schedule/edit/cancel controls and role-specific calendar controls.
- [ ] Run the focused BD test and confirm it fails because the controls are hidden or unauthorized.
- [ ] Expose the existing interview form/edit controls to BD-owned applications and pass eligible Closers.
- [ ] Restrict calendar actions: BD/Admin can cancel and manage interview metadata; Closers can record attendance and closer notes.
- [ ] Run the focused BD and Closer suites and confirm they pass.

### Task 2: BD collaboration and offer surfaces

**Files:**
- Modify: `apps/web/e2e/bd-workflows.spec.ts`
- Inspect/modify: `apps/web/app/leads/[leadId]/[section]/page.tsx`
- Inspect/modify: `apps/web/components/leads/collaboration-form.tsx`
- Inspect/modify: `apps/web/components/offers/offer-form.tsx`

- [ ] Add failing browser coverage for creating a comment, creating a communication, and creating/editing an offer on the owned application.
- [ ] Run the focused test and confirm each missing control or mutation failure is real.
- [ ] Make only the minimal UI/API fixes required for BD-owned records.
- [ ] Rerun the focused workflow test and confirm persisted records are visible after reload.

### Task 3: BD task and application workflow

**Files:**
- Modify: `apps/web/e2e/bd-workflows.spec.ts`
- Inspect/modify: `apps/web/components/tasks/task-actions.tsx`
- Inspect/modify: `apps/web/app/tasks/page.tsx`
- Inspect/modify: `apps/web/app/leads/[leadId]/page.tsx`

- [ ] Add browser coverage for BD task visibility and completion/cancellation controls.
- [ ] Add browser coverage for application status/importance controls if present.
- [ ] Run focused tests, fix only missing role-aware controls, and verify the persisted state.

### Task 4: Full verification and handoff

**Files:**
- Modify: `.superpowers/sdd/2026-09-03-admin-mvp-completion/progress.md`

- [ ] Run web/backend TypeScript checks.
- [ ] Run `git diff --check`.
- [ ] Run the complete Playwright suite with `.env` loaded and ports 3100/3101.
- [ ] Check frontend login and backend live/readiness endpoints.
- [ ] Record exact test counts and any intentionally untested external Google/file-upload behavior.
