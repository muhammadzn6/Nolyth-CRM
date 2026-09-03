# Task 2 report — admin user and invitation services

## Delivered

- Added `UserManagementService` with admin-only `list`, `create`, `update`, and `revokeSessions` operations.
- Added runtime validation with the shared user-management contracts so invalid role or update payloads fail as `ValidationError`s at the backend boundary.
- Added invitation issuance that creates invited users with `passwordHash = null`, stores only a `sha256:` token hash, sets `USER_INVITATION`, and expires the token seven days after issuance.
- Added transactional invitation side effects for user creation: immutable audit record plus `email.send_requested` outbox append in the same transaction.
- Added `InvitationService.accept` that validates the opaque token, rejects expired/consumed invitations with the generic authentication error, hashes the accepted password with Argon2id, marks the invitation consumed, and revokes existing sessions.
- Extended `SessionService` with `revokeUserSessions(...)` so create/login, admin revoke, activation/deactivation, and invitation acceptance can share one revocation path.
- Exported the new backend services from `packages/backend/src/index.ts`.

## Red → green evidence

- RED: `./node_modules/.bin/vitest run packages/backend/src/users/user-management.service.test.ts`
  - failed because `./invitation.service` did not exist.
- GREEN: the same focused command passed with `1` file and `8/8` tests.

## Bounded verification

- `./node_modules/.bin/vitest run packages/backend/src` — PASS, `6` files and `35/35` tests.
- `./node_modules/.bin/tsc --noEmit -p packages/backend/tsconfig.json` — PASS.
- `./node_modules/.bin/eslint --config eslint.config.mjs packages/backend/src` — PASS.
- `git diff --check` — PASS.

## Scope kept intentionally out

- No password-reset or resend-invitation behavior was added.
- No API/controller, web UI, or database schema changes were made in this task.

## Review-finding fix

- Made invitation acceptance a one-time transactional claim with `tokenHash`, `purpose = USER_INVITATION`, `consumedAt = null`, and `expiresAt > acceptedAt` in the conditional update. Only the successful claimant hashes the password, updates the user, and revokes existing sessions; concurrent losers receive the same generic invalid-invitation authentication error.
- Translated Prisma-style `P2002` unique email races from the transactional user create path into the existing duplicate-email `ConflictError`.
- Added transactional activity events for user updates, deactivations, reactivations, and explicit session revocation, preserving actor id/name/role snapshots and the existing invitation outbox append on user creation.
- Extended the typed in-memory persistence mock with conditional auth-token `updateMany` behavior and session-revocation counts for the new audit metadata.

## Review-fix red → green evidence

- RED: `./node_modules/.bin/vitest run packages/backend/src/users/user-management.service.test.ts`
  - failed 5 tests for raw `P2002` propagation, missing update/deactivate/reactivate/revoke audit events, and double-fulfilled concurrent invitation acceptance.
- GREEN: `./node_modules/.bin/vitest run packages/backend/src/users/user-management.service.test.ts`
  - passed 1 file and 11/11 tests.

## Review-fix bounded verification

- `./node_modules/.bin/vitest run packages/backend/src` — PASS, 6 files and 38/38 tests.
- `./node_modules/.bin/tsc --noEmit -p packages/backend/tsconfig.json` — PASS.
- `./node_modules/.bin/eslint --config eslint.config.mjs packages/backend/src` — PASS.
- `git diff --check` — PASS.
