# Local-development runbook

## Start from a clean checkout

Prerequisites are Node.js 20.9+, pnpm 10.15.1, Docker, and Docker Compose.

```bash
pnpm install --frozen-lockfile
cp .env.example .env
set -a
source .env
set +a
docker compose up -d
docker compose ps
pnpm db:generate
pnpm db:migrate
export ORBIT_SEED_ADMIN_PASSWORD='choose-a-local-password'
pnpm db:seed
pnpm dev
```

Expected process ports are web `3100`, API `3101`, PostgreSQL `55432`, Redis `6379`, MinIO API `9000`, and MinIO console `9001`. The API and worker fail fast when required server variables are absent. Keep the shell that runs `pnpm dev` in the foreground so Turbo can stop all three processes together.

Ports `3000` and `3001` are reserved for unrelated local services. Use web `3100` and API `3101` for Orbit development.

## Check readiness

```bash
docker compose ps
curl --fail http://localhost:3101/health/live
curl --fail http://localhost:3101/health/ready
```

Liveness proves the API process is serving. Readiness additionally checks PostgreSQL and Redis. It does not check MinIO because storage behavior is not implemented yet. Worker readiness is internal to the worker runtime and covered by focused tests; there is no worker HTTP health endpoint in this foundation.

## Run one boundary

Load `.env` into the shell first, then use:

```bash
pnpm dev:web
pnpm dev:api
pnpm dev:worker
```

The web app alone can render `/login`, but authenticated pages require the API and database. The worker requires PostgreSQL and Redis. `API_PORT` optionally overrides the API's port without changing Next.js's standard `PORT`; the Playwright smoke uses this to isolate its runtime.

## Database and seed operations

```bash
pnpm db:generate
pnpm db:validate
pnpm db:migrate
export ORBIT_SEED_ADMIN_PASSWORD='new-local-password'
pnpm db:seed
```

Migrations are forward-only. The seed upserts only `admin@orbit.local`, hashes the supplied password with Argon2id, activates the account, and rotates its password hash. It does not create representative domain data.

## Bootstrap and manage local users

The seed is a bootstrap step for the first local administrator only:

```bash
export ORBIT_SEED_ADMIN_PASSWORD='choose-a-local-password'
pnpm db:seed
pnpm dev
```

Then use the admin UI for every additional account:

1. Sign in at `http://localhost:3100/login` as `admin@orbit.local` with `ORBIT_SEED_ADMIN_PASSWORD`.
2. Open `http://localhost:3100/admin/users`.
3. Create a user with a name, normalized work email, role (`ADMIN`, `BD`, or `CLOSER`), and timezone.
4. Copy the one-time invitation link displayed after creation. It is not recoverable later because only the token hash is stored.
5. Have the teammate open `/invite/<token>`, create a password of at least 12 characters, and sign in.
6. Use the same admin page to update role/name/timezone, deactivate or reactivate the account, or revoke active sessions.

## Candidate and profile workflow

1. Sign in as an active Admin and open `http://localhost:3100/candidates`.
2. Create a candidate record. This does not create a login account.
3. Open the candidate and create one or more profiles for separate job-search campaigns.
4. Open a profile workspace to set target roles, locations, compensation, and preferences.
5. Assign active BD users and eligible Closers from the profile Team panel. Ending an assignment preserves its history.
6. Active BDs can view profiles assigned to them; only Admins can create candidates, manage assignments, change lifecycle state, or archive/restore records.

Deactivation and explicit session revocation invalidate active sessions server-side. Re-run `pnpm db:seed` only when you intentionally want to rotate the bootstrap admin’s local password.

## Run foundation verification safely

The PostgreSQL persistence tests rebuild the public schema and accept only the disposable `orbit_task3_test` database. Run them through `pnpm test` with the test-only override documented in [Foundation verification](../verification/foundation.md). Then restore `DATABASE_URL` to the normal local `orbit` database, migrate and seed it, and run `pnpm test:e2e`.

Root E2E runs API/worker checks first and Playwright smoke second. It does not run the destructive database suite, so the migrated and seeded `orbit` database remains available to the browser smoke. Never run the guarded persistence suite and Playwright smoke in parallel against the same database; the persistence suite drops and rebuilds the public schema.

## Recovery

Inspect services and logs:

```bash
docker compose ps
docker compose logs postgres redis object-storage
docker compose restart postgres redis object-storage
```

If a port is occupied, stop the owning local process or change the relevant published port and matching environment value. Do not point verification at an unrelated process; the browser smoke deliberately uses ports `3100` and `3101` and refuses to reuse existing servers.

To stop services while preserving named volumes:

```bash
docker compose down
```

Destructive local reset (deletes all Compose PostgreSQL, Redis, and object-storage data):

```bash
docker compose down --volumes
docker compose up -d
pnpm db:migrate
pnpm db:seed
```

Run the destructive reset only for disposable local data. Never use this procedure against shared, staging, or production infrastructure.

## Stop application processes

Use `Ctrl-C` in the foreground Turbo shell. The API uses Nest's process lifetime and the worker handles `SIGINT`/`SIGTERM`, closes its consumer before queue resources, and disconnects Prisma. If a prior interrupted run left ports occupied, identify the exact process before terminating it; do not kill broad process groups by name.
