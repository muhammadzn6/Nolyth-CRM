# Foundation verification

## Static and unit gates

With dependencies installed and environment variables loaded:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm db:validate
pnpm test
pnpm build
```

`format:check` is currently a repository whitespace/conflict-marker check (`git diff --check`), not a full-source formatter. The existing foundation has no formatter dependency or canonical formatting policy; adding one and mass-formatting historical source is separate work.

The database persistence suite intentionally refuses to run unless `DATABASE_URL` names the disposable `orbit_task3_test` database because it drops and rebuilds the public schema. Create that local database once, then override only the test command:

```bash
docker compose exec postgres createdb -U orbit orbit_task3_test
DATABASE_URL=postgresql://orbit:orbit@localhost:55432/orbit_task3_test pnpm test
```

If `createdb` reports that the database already exists, keep using the existing disposable test database. Never rename a development, shared, staging, or production database to bypass the guard.

## Runtime smoke

Migrate and seed the normal local `orbit` database first:

```bash
export DATABASE_URL=postgresql://orbit:orbit@localhost:55432/orbit
pnpm db:migrate
export ORBIT_SEED_ADMIN_PASSWORD='choose-a-local-password'
pnpm db:seed
pnpm test:e2e
```

The web Playwright config uses a local-binary launcher that mirrors the root Turbo `dev` graph and launches web, API, and worker together. It isolates web/API on `3100`/`3101`, waits for the login route, and then verifies:

1. the public login page renders usable controls;
2. `GET /health/live` returns the standard success envelope;
3. the seeded admin can authenticate and reach the role-aware shell.
4. the seeded admin can create a user invitation, the invited user can accept it with their own password, the invited non-admin does not see admin navigation, and the admin can revoke sessions and deactivate that user.

Root `test:e2e` also runs the package API E2E suite. Worker lifecycle/outbox behavior is covered by focused worker/backend tests; the worker has no external HTTP endpoint yet.

The destructive PostgreSQL persistence suite runs only under `pnpm test`; it is not part of `pnpm test:e2e`. Root E2E runs the API/worker stage to completion before Playwright starts, so the browser smoke can use the documented migrated and seeded `orbit` database without racing schema resets or admin deletion.

## CI order

CI uses a disposable PostgreSQL database named `orbit_task3_test` and Redis. The workflow runs frozen install, Prisma client generation, whitespace integrity, lint, strict typecheck, Prisma validation, unit/live integration tests, migration, workspace build, API/worker E2E checks, Chromium installation, seed, and browser smoke as separate ordered steps. MinIO is not started because no current test or runtime path accesses object storage.

## Evidence rules

- Record the exact command, exit code, test count when available, and any warning that affects interpretation.
- Do not report a skipped or environment-blocked command as passed.
- A successful Next.js build does not mean target-domain screens or APIs are implemented.
- API/worker `build` tasks are currently strict TypeScript gates and do not emit deployment artifacts.
- Preserve the approved target design and historical plan; reports describe implementation state rather than rewriting those sources.
