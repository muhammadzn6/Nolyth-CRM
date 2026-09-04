# Foundation architecture

## Runtime shape

Orbit is a modular monolith deployed as three cooperating TypeScript processes:

```text
Browser -> apps/web (Next.js) -> apps/api (NestJS) -> PostgreSQL
                                      |                ^
                                      v                |
                                  outbox rows -> Redis/BullMQ -> apps/worker
                                                               | provider ports
                                                               v
                                                         email/storage/notifications
```

`apps/web` imports browser-safe configuration, shared contracts, and shared UI only. It does not import backend or persistence code. `apps/api` owns HTTP authentication, authorization, validation, application-service composition, and database access. `apps/worker` polls durable outbox rows, publishes/consumes BullMQ jobs, and invokes provider ports. PostgreSQL remains the source of truth; Redis jobs are recoverable delivery work, not authoritative business state.

## Workspace boundaries

| Path | Current responsibility |
|---|---|
| `apps/web` | Next.js App Router login, authenticated shell, admin users page, and invitation acceptance page |
| `apps/api` | NestJS bootstrap, identity/user-management endpoints, request context, errors, health |
| `apps/worker` | Outbox dispatch/processing and worker lifecycle |
| `packages/config` | Zod-validated server and browser environment |
| `packages/contracts` | Shared transport schemas and response types |
| `packages/database` | Prisma schema/client, migrations, transaction helper, seed |
| `packages/backend` | Identity, authorization, errors, outbox, provider ports |
| `packages/ui` | Shared Tailwind-oriented UI primitives |
| `packages/testing` | Workspace and documentation contract checks |

Root-level prototype application files are outside this workspace graph. They are retained user/project history, not an alternate supported runtime.

## Implemented identity, invitation, and session flow

1. The browser posts credentials to `POST /api/v1/auth/login` through the typed web client.
2. The API checks the request origin, validates the strict Zod payload, performs constant-work Argon2id verification, and rejects inactive or unusable accounts with a generic error.
3. A random session token is returned only as a secure, HTTP-only, SameSite cookie; PostgreSQL stores its HMAC hash.
4. The Next.js server forwards the cookie to `GET /api/v1/auth/me` before rendering the authenticated shell.
5. API authorization services deny by default and scope profile access by role and active assignment.

The bootstrap seed upserts `admin@orbit.local` with an operator-supplied password. From there, only active administrators can create additional users through `POST /api/v1/users`; the service creates a nullable-password user, records audit/outbox side effects in the transaction, stores a hashed `USER_INVITATION` token, and returns the opaque token once so the web UI can display `/invite/<token>`. Invitation acceptance uses `POST /api/v1/auth/invitations/accept`, conditionally claims an unexpired and unconsumed token, hashes the teammate’s chosen password with Argon2id, consumes the token, revokes existing sessions for that user, and sets a normal session cookie. Admin updates can change display name, role, timezone, activation, and explicit session revocation; deactivation also revokes active sessions immediately.

The current identity surface is login, logout, current-session lookup, admin user management, and admin-issued invitation acceptance. Password reset/change, resend invitation, login rate limiting, compromised-password checks, MFA/SSO, and broader admin lifecycle controls remain target work.

## Implemented outbox flow

Business services can append an outbox row inside the caller's Prisma transaction. The worker claims pending rows with a recoverable lease, publishes deduplicated BullMQ jobs, rechecks authorization-sensitive state, and invokes local provider ports. Retries are bounded with exponential backoff; exhausted work is recorded for dead-letter handling. Local email and in-app providers are no-op adapters, and object-storage behavior is not yet implemented.

## Persistence scope

The schema currently establishes identity, candidate/profile assignment, lead ownership/status history, immutable activity context, and outbox foundations. It does not establish every table, constraint, projection, or query required by the approved target-state design. Future domain plans must add forward-only migrations and the corresponding contracts, authorization, audit/outbox behavior, UI states, and tests.

## Build and deployment truth

`pnpm build` runs each workspace build task and produces the Next.js production bundle. The current shared-package, API, and worker TypeScript configurations are strict compilation gates with `noEmit`; deployable API/worker artifacts, container images, environment promotion, rollback automation, and staging/production infrastructure are not part of this foundation.

## Verification orchestration

Root `pnpm test` owns the guarded PostgreSQL persistence suite and must use the disposable `orbit_task3_test` database because those tests rebuild the public schema. Root `pnpm test:e2e` deliberately runs only service E2E checks first and then the Playwright browser smoke on isolated ports `3100` and `3101`; it does not include `pnpm test` or database schema-reset tests. This preserves the migrated and seeded local `orbit` database for the browser flows, including admin invitation creation and acceptance.

## Remaining target domains

Separate plans are still required for password recovery, candidate/profile/assignment workflows, leads/collaboration, documents/files, interviews/availability/scheduling, tasks/notifications, offers/placements, analytics/exports, broader admin/archive workflows, OpenAPI/client generation, production providers, security hardening, observability, scale testing, backup/recovery, deployment, and launch/UAT. The final ownership, source/reference-data, and canonical lead-status decisions identified in the foundation plan also remain unresolved.
