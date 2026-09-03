# Orbit CRM Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deliver the functional Orbit CRM MVP, data movement, authentication, contract tooling, and browser verification. File upload behavior and production hardening are deferred.

**Architecture:** Extend the existing TypeScript modular monolith. Keep business rules in `packages/backend`, schemas in `packages/contracts`, persistence/migrations in `packages/database`, NestJS transport in `apps/api`, and server-first Next.js routes/client components in `apps/web`. Use local adapters for MinIO, email, scanner, metrics, and backups; production adapters remain configuration-driven.

**Tech Stack:** TypeScript, NestJS, Next.js App Router, React, Zod, Prisma/PostgreSQL, BullMQ/Redis, MinIO/S3, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-03-orbit-crm-completion-design.md`

## Global Constraints

- Frontend remains on port `3100` and backend remains on port `3101`.
- Ports `3000` and `3001` are reserved and must not be started, stopped, or reconfigured.
- API authorization is the source of truth; frontend role checks are only UX.
- Mutations use optimistic versions and return a conflict when the submitted version is stale.
- File upload behavior and production hardening are deferred until after MVP validation.

### Task 1: Lead and profile workflow UI

Files: `apps/web/app/leads/[leadId]/page.tsx`, `apps/web/components/leads/lead-workspace.tsx`, `apps/web/components/profiles/profile-workspace.tsx`, `apps/web/lib/api-client.ts`.

Add real lead detail and profile section links. Cover lead summary, status transitions, ownership/Closer assignment, communications, comments, offers, and activity. Preserve server-first loading and use client components for mutations. Add tests for role visibility, stale-version errors, and successful transitions.

### Task 2: Scheduling and work queues UI

Files: `apps/web/app/interviews/page.tsx`, `apps/web/app/tasks/page.tsx`, `apps/web/app/availability/page.tsx`, related client components and API client functions.

Add interview create/reschedule/conflict/report controls, task complete/cancel controls, and availability rule/exception editing. Use existing contracts and role permissions. Add focused component tests and API-client contract tests.

### Task 3: Offers and placement UI

Files: `apps/web/app/offers/page.tsx`, `apps/web/components/offers/offer-workspace.tsx`, `apps/web/lib/api-client.ts`.

Add offer creation/editing, accept/decline, placement date, and start actions. Display optimistic version conflicts and notification outcomes. Test the offer-to-placement workflow.

### Task 4: Imports and exports

Files: `packages/contracts/src/imports.ts`, `packages/backend/src/imports/`, `apps/api/src/modules/imports/`, `apps/web/app/imports/page.tsx`, `apps/web/app/exports/`, database migration only if import records are required.

Implement bounded CSV preview/commit with row-level validation, import idempotency, maximum file/row/field limits, role-scoped candidate/lead imports, and fixed-column CSV exports. Test malformed input, duplicate keys, authorization, preview no-write behavior, commit behavior, and CSV escaping.

### Task 5: Complete audit and notification producers

Files: domain services under `packages/backend/src`, `apps/api` module controllers/modules, `packages/backend/src/notifications/`.

Add activity events for every mutation with request ID and actor snapshots. Add document upload/version/archive notifications and ensure all notification creation is idempotent. Test event contents, role scope, retry behavior, and duplicate prevention.

### Task 6: Authentication completion

Files: `packages/contracts/src/auth.ts`, `packages/backend/src/identity/`, `packages/backend/src/users/`, `apps/api/src/modules/identity/`, `apps/web/app/forgot-password/`, `apps/web/app/reset-password/`, `apps/web/app/settings/`.

Implement hashed single-use expiring reset tokens, authenticated password change with session revocation, and invitation resend with token rotation. Test enumeration resistance, expiry, reuse rejection, current-password checks, and role restrictions.

### Task 7: OpenAPI and generated client

Files: `apps/api/src/openapi/`, `packages/contracts/`, `packages/api-client/`, root scripts/config.

Generate an OpenAPI artifact from the Nest route contract and checked-in schemas. Generate a typed client from that artifact and add CI validation that generation is deterministic and errors preserve the existing envelope.

### Task 8: Browser verification and release gate

Files: `apps/web/e2e/`, `apps/api`/`apps/worker` E2E fixtures, CI workflow.

Add Admin/BD/Closer browser journeys for login/scope, lead lifecycle, scheduling, tasks, offer placement, import preview/commit, and password recovery. File-upload journeys are deferred. Run migration reset on `orbit_task3_test`, all unit/integration tests, typechecks, lint, build, browser tests, and health checks on `3100/3101`.

Each task must use test-first changes, run its focused tests, run the relevant full suite, and commit independently before the next task.
