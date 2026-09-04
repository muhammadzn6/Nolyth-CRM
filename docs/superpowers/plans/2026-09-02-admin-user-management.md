# Admin User Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an admin-controlled user-management flow where administrators create, invite, activate, deactivate, role-change, and revoke sessions for Orbit users without handling their passwords.

**Architecture:** Extend the existing modular monolith with an API Users module, a single-use expiring invitation token backed by `auth_tokens`, and an authenticated web admin users page plus public invitation acceptance page. Admin mutations run through backend authorization and database transactions; invitation URLs contain opaque tokens and never expose password material.

**Tech Stack:** TypeScript, NestJS, Next.js App Router, Prisma/PostgreSQL, Zod contracts, Argon2id, Vitest/Jest.

**Spec:** `/Users/mzohaibnasir/Downloads/2026-09-01-orbit-crm-design.md` (identity/user-management requirements, especially account provisioning and deactivation).

## Global Constraints

- Only `ADMIN` actors may manage users.
- Roles are exactly `ADMIN`, `BD`, and `CLOSER`.
- Invitations are single-use and expire; store only a hash of the opaque token.
- Passwords are Argon2id hashes; plaintext passwords and invitation tokens are never persisted or logged.
- Deactivation revokes all active sessions immediately.
- Historical activity retains actor snapshots; user mutations write audit/outbox records in the same transaction where supported.
- Responses use the existing shared success/error envelopes and request IDs.
- Existing login/logout/session behavior must remain compatible.

### Task 1: Add user-management persistence and contracts

**Files:**
- Modify: `packages/database/prisma/schema.prisma`
- Create: `packages/database/prisma/migrations/<timestamp>_user_management/migration.sql`
- Modify: `packages/contracts/src/users.ts`
- Modify: `packages/contracts/src/index.ts`
- Test: `packages/contracts/src/users.test.ts`
- Test: `packages/database/src/user-management.test.ts`

**Interfaces:**
- `userSummarySchema` exposes `id`, `displayName`, `email`, `role`, `isActive`, `timezone`, `lastLoginAt`.
- `createUserSchema` accepts `displayName`, `email`, `role`, and `timezone`.
- `updateUserSchema` accepts optional `displayName`, `role`, `timezone`, and `isActive`.
- `acceptInvitationSchema` accepts an opaque `token` and new `password`.
- `auth_tokens` supports purpose `USER_INVITATION`, token hash, expiry, consumption timestamp, and invited user relation.

- [ ] Write failing strict-schema and persistence tests for invitation uniqueness/expiry/consumption and nullable password hashes.
- [ ] Run the focused tests and verify failure because the model/contracts do not exist.
- [ ] Add the Prisma model, forward-only migration, and strict Zod schemas with case-insensitive email handling.
- [ ] Run Prisma generate, migration validation, contract tests, and database tests against a disposable database.
- [ ] Commit: `feat: add user management persistence and contracts`.

### Task 2: Implement admin user and invitation services

**Files:**
- Create: `packages/backend/src/users/user-management.service.ts`
- Create: `packages/backend/src/users/invitation.service.ts`
- Create: `packages/backend/src/users/user-management.service.test.ts`
- Modify: `packages/backend/src/index.ts`
- Modify: `packages/backend/src/identity/session.service.ts`

**Interfaces:**
- `UserManagementService.list(actor): Promise<UserSummary[]>`.
- `UserManagementService.create(actor, input): Promise<{ user: UserSummary; invitationToken: string }>`.
- `UserManagementService.update(actor, userId, input): Promise<UserSummary>`.
- `UserManagementService.revokeSessions(actor, userId): Promise<void>`.
- `InvitationService.accept(token, password): Promise<SessionUser>`.

- [ ] Write failing service tests for admin-only access, duplicate email conflict, role validation, invitation token hashing, invitation expiry/one-time use, activation/deactivation session revocation, and self-deactivation protection.
- [ ] Run the focused backend tests and verify failure.
- [ ] Implement transactional user creation plus audit/outbox records, opaque token issuance, Argon2id password setup, and session revocation.
- [ ] Run backend tests, typecheck, and lint.
- [ ] Commit: `feat: add admin user management services`.

### Task 3: Expose protected API routes

**Files:**
- Create: `apps/api/src/modules/users/users.module.ts`
- Create: `apps/api/src/modules/users/users.controller.ts`
- Create: `apps/api/src/modules/users/users.controller.test.ts`
- Create: `apps/api/src/modules/users/users.e2e.test.ts`
- Create: `apps/api/src/modules/invitations/invitations.controller.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**
- `GET /api/v1/users` — admin-only list.
- `POST /api/v1/users` — admin-only create and invitation issuance.
- `PATCH /api/v1/users/:id` — admin-only update/activation/role change.
- `POST /api/v1/users/:id/revoke-sessions` — admin-only session revocation.
- `POST /api/v1/auth/invitations/accept` — public token acceptance and session creation.

- [ ] Write failing controller tests for 403 non-admin denial, 422 strict payloads, 409 duplicate email, successful create/update/deactivate, and invitation acceptance.
- [ ] Implement controllers with existing guard, validation, error filter, secure cookie, and response envelope conventions.
- [ ] Run focused API tests and typecheck; document socket-binding limits if E2E needs escalation.
- [ ] Commit: `feat: add admin user management api`.

### Task 4: Build admin users and invitation UI

**Files:**
- Create: `apps/web/app/admin/users/page.tsx`
- Create: `apps/web/app/invite/[token]/page.tsx`
- Create: `apps/web/components/admin/users-page.tsx`
- Create: `apps/web/components/admin/user-form.tsx`
- Create: `apps/web/components/auth/invitation-form.tsx`
- Modify: `apps/web/lib/api-client.ts`
- Test: `apps/web/components/admin/users-page.test.tsx`
- Test: `apps/web/components/auth/invitation-form.test.tsx`

**Interfaces:**
- Admin users page lists users with loading, empty, error, unauthorized, active, and inactive states.
- Admin can create a user, copy a one-time invitation URL, edit role/name/timezone, activate/deactivate, and revoke sessions.
- Invitation page validates token/password fields, shows expired/used/error states, and redirects to login after success.
- Client uses typed contracts and never sends passwords except to invitation acceptance.

- [ ] Write failing UI/client tests for admin-only navigation, create/invite, deactivate/revoke, invitation success, invalid token, and expired token states.
- [ ] Implement server/client components with accessible forms, pending/error feedback, and responsive Orbit styling.
- [ ] Run focused web tests, typecheck, lint, and build.
- [ ] Commit: `feat: add admin user management ui`.

### Task 5: Integrate documentation and end-to-end verification

**Files:**
- Modify: `README.md`
- Modify: `docs/runbooks/local-development.md`
- Modify: `docs/architecture/foundation.md`
- Modify: `docs/security/foundation.md`
- Create: `apps/web/e2e/user-management.spec.ts`
- Test: `packages/testing/src/user-management-orchestration.test.ts`

- [ ] Add local bootstrap instructions: seed the first admin, sign in, create users, accept invitations, and rotate/revoke access.
- [ ] Add regression coverage proving destructive database tests never run concurrently with browser smoke.
- [ ] Run the full available suite, API/web typechecks, lint, build, and serialized E2E stages; record environment limitations exactly.
- [ ] Commit: `docs: document admin user management and verification`.

## Self-review notes

- The seed remains intentionally limited to bootstrapping the first local admin; normal account creation moves to the admin UI/API.
- Public signup is not added because the product has internal Admin, BD, and Closer roles; only admin-issued invitations can create accounts.
- Password reset and resend-invitation behavior are intentionally deferred unless required by the user-management implementation review.
