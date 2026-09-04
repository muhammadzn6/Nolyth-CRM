# Candidates and Profiles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first target-domain CRM slice: candidate records, multiple job-search profiles, BD assignments, eligible Closer assignments, and a role-aware profile workspace.

**Architecture:** Extend the existing Prisma modular monolith with candidate/profile state and assignment history, expose validated NestJS services/controllers, and add a focused Next.js workspace. Authorization is enforced in services before queries and mutations; every mutation emits an audit activity event in the same transaction.

**Tech Stack:** NestJS, Prisma/PostgreSQL, Zod contracts, Argon2-backed identity/session guards, Next.js 16, React 19, Tailwind CSS, Vitest, Supertest, Playwright.

**Spec:** `/Users/mzohaibnasir/Downloads/2026-09-01-orbit-crm-design.md` sections 4, 5, 8.3, 9.4, 10.4, 14, 17, and 19.

## Global Constraints

- Never use ports 3000 or 3001; local Orbit runs on web 3100 and API 3101.
- Candidate records are CRM records, not login accounts.
- A candidate may own multiple profiles; a profile belongs to exactly one candidate.
- Only active ADMIN users may manage profile BD and Closer assignments.
- Assigned BDs may view assigned profiles; only ADMIN may archive/restore or override assignments.
- Assignment deletion ends history; it never erases the assignment row.
- Archived candidates cannot receive new profiles; archived profiles cannot receive new leads or assignments.
- Mutations must be validated with shared Zod schemas and audited transactionally.
- Use optimistic concurrency through the existing `version` field for updates.

### Task 1: Candidate and Profile Persistence and Contracts

**Files:**
- Modify: `packages/database/prisma/schema.prisma`
- Create: `packages/database/prisma/migrations/20260902100000_candidates_profiles/migration.sql`
- Modify: `packages/contracts/src/users.ts`
- Create: `packages/contracts/src/candidates.ts`
- Modify: `packages/contracts/src/index.ts`
- Test: `packages/database/src/candidates-profiles.test.ts`
- Test: `packages/contracts/src/candidates.test.ts`

**Interfaces:**
- Produces Prisma models `Candidate`, `Profile`, `ProfileBdAssignment`, and `ProfileCloserEligibility` with candidate name/contact/status/archive fields, profile campaign/preferences fields, and historical assignment rows.
- Produces schemas/types `candidateSummarySchema`, `createCandidateSchema`, `updateCandidateSchema`, `profileSummarySchema`, `createProfileSchema`, `updateProfileSchema`, `assignmentSchema`, and list query schemas.
- Candidate status is `ACTIVE` or `ARCHIVED`; profile status is `DRAFT`, `ACTIVE`, `PAUSED`, or `ARCHIVED`.

- [ ] Write failing contract tests for normalization, invalid status transitions, empty updates, and required profile candidate/name fields.
- [ ] Run `./node_modules/.bin/vitest run packages/contracts/src/candidates.test.ts` and confirm failure.
- [ ] Add the Prisma fields, relations, indexes, migration, and shared Zod schemas.
- [ ] Add database tests proving multiple profiles per candidate, unique active assignment pairs, ended assignment history, and version columns.
- [ ] Run Prisma validation/generation and the focused contract/database tests.
- [ ] Commit `feat: add candidate and profile persistence contracts`.

### Task 2: Candidate/Profile Services and Authorization

**Files:**
- Create: `apps/api/src/modules/candidates/candidates.service.ts`
- Create: `apps/api/src/modules/candidates/candidates.module.ts`
- Create: `apps/api/src/modules/candidates/candidates.service.test.ts`
- Modify: `apps/api/src/modules/identity/identity.guard.ts` only if an existing reusable authorization helper is insufficient
- Test: `apps/api/src/modules/candidates/candidates.service.test.ts`

**Interfaces:**
- `listCandidates(actor, query): Promise<Page<CandidateSummary>>`
- `createCandidate(actor, input): Promise<CandidateSummary>`
- `getCandidate(actor, candidateId): Promise<CandidateDetail>`
- `updateCandidate(actor, candidateId, input, expectedVersion): Promise<CandidateSummary>`
- `archiveCandidate(actor, candidateId, reason, expectedVersion): Promise<CandidateSummary>`
- `restoreCandidate(actor, candidateId, expectedVersion): Promise<CandidateSummary>`
- `listProfiles(actor, query): Promise<Page<ProfileSummary>>`
- `createProfile(actor, input): Promise<ProfileSummary>`
- `getProfile(actor, profileId): Promise<ProfileDetail>`
- `updateProfile(actor, profileId, input, expectedVersion): Promise<ProfileSummary>`
- `transitionProfile(actor, profileId, status, reason, expectedVersion): Promise<ProfileSummary>`
- `listBdAssignments(actor, profileId): Promise<AssignmentSummary[]>`
- `assignBd(actor, profileId, userId): Promise<AssignmentSummary>`
- `endBdAssignment(actor, profileId, assignmentId, reason): Promise<void>`
- `listCloserEligibility(actor, profileId): Promise<AssignmentSummary[]>`
- `setCloserEligibility(actor, profileId, userId): Promise<AssignmentSummary>`
- `endCloserEligibility(actor, profileId, assignmentId, reason): Promise<void>`

- [ ] Write service tests for Admin full access, assigned BD access, unassigned BD denial, Closer limited context, inactive actor denial, archived-record rules, duplicate assignment handling, and optimistic concurrency.
- [ ] Run the focused service test and confirm failure.
- [ ] Implement scoped queries, role checks, state transitions, assignment validation by user role, transactional audit events, and conflict mapping.
- [ ] Run focused service tests plus existing identity/API tests.
- [ ] Commit `feat: add candidate and profile services`.

### Task 3: Candidate/Profile API

**Files:**
- Create: `apps/api/src/modules/candidates/candidates.controller.ts`
- Create: `apps/api/src/modules/candidates/candidates.controller.test.ts`
- Create: `apps/api/src/modules/candidates/candidates.e2e.test.ts`
- Modify: `apps/api/src/app.module.ts`
- Modify: `packages/contracts/src/candidates.ts` if response envelopes need exact API shapes

**Interfaces:**
- `GET/POST /api/v1/candidates`
- `GET/PATCH /api/v1/candidates/:candidateId`
- `POST /api/v1/candidates/:candidateId/archive`
- `POST /api/v1/candidates/:candidateId/restore`
- `GET/POST /api/v1/profiles`
- `GET/PATCH /api/v1/profiles/:profileId`
- `POST /api/v1/profiles/:profileId/activate|pause|archive|restore`
- `GET/POST /api/v1/profiles/:profileId/bd-assignments`
- `DELETE /api/v1/profiles/:profileId/bd-assignments/:assignmentId`
- `GET/POST /api/v1/profiles/:profileId/closer-eligibility`
- `DELETE /api/v1/profiles/:profileId/closer-eligibility/:assignmentId`

- [ ] Add controller tests for envelope shape, validation, authentication, and error mapping.
- [ ] Add API E2E tests for Admin create/update/archive/restore, BD scoped list/detail, and assignment endpoints.
- [ ] Implement thin route handlers using the service interfaces and existing request actor/version conventions.
- [ ] Run API unit/E2E tests, lint, and strict typecheck.
- [ ] Commit `feat: expose candidate and profile api`.

### Task 4: Profile Workspace UI

**Files:**
- Create: `apps/web/app/candidates/page.tsx`
- Create: `apps/web/app/candidates/[candidateId]/page.tsx`
- Create: `apps/web/app/profiles/[profileId]/page.tsx`
- Create: `apps/web/components/candidates/candidate-list.tsx`
- Create: `apps/web/components/candidates/candidate-form.tsx`
- Create: `apps/web/components/profiles/profile-form.tsx`
- Create: `apps/web/components/profiles/profile-workspace.tsx`
- Modify: `apps/web/lib/api-client.ts`
- Modify: `apps/web/components/layout/app-shell.tsx`
- Test: `apps/web/lib/api-client.test.ts`
- Test: `apps/web/e2e/candidates-profiles.spec.ts`

**Interfaces:**
- API client methods mirror the candidate/profile endpoints and preserve typed envelope parsing.
- `/candidates` lists searchable candidates and links to candidate details.
- Candidate detail creates and lists multiple profiles.
- Profile workspace shows status, candidate context, assigned BDs, eligible Closers, and role-appropriate controls.

- [ ] Add client tests for request validation, response parsing, and version conflict errors.
- [ ] Implement pages/components using existing shell and UI primitives, with accessible forms, loading, empty, error, and unauthorized states.
- [ ] Hide Admin-only assignment/archive controls from non-admin users while retaining backend enforcement.
- [ ] Add Playwright smoke for Admin create candidate/profile/assignments and BD read-only/scoped workspace.
- [ ] Run web tests, lint, typecheck, and the focused Playwright smoke on 3100/3101.
- [ ] Commit `feat: add candidate and profile workspace`.

### Task 5: Documentation, Seed Data, and Final Verification

**Files:**
- Modify: `README.md`
- Modify: `docs/runbooks/local-development.md`
- Modify: `docs/architecture/foundation.md`
- Modify: `docs/verification/foundation.md`
- Modify: `packages/database/prisma/seed.ts`
- Test: `packages/testing/src/documentation.test.ts`

- [ ] Add local workflow documentation for candidate/profile creation and assignment permissions.
- [ ] Extend the guarded local seed with representative candidate/profile data only when explicitly enabled by a local seed flag; never add production-like personal data.
- [ ] Run full focused verification: Prisma validate/generate/migrate, contracts, API, web, lint, typecheck, diff check, and Playwright smoke.
- [ ] Review the final diff for unrelated changes and record remaining roadmap items.
- [ ] Commit `docs: document candidate and profile workflows`.
