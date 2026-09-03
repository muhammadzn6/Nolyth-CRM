# Client-scoped Google Calendars

## Goal

Allow an Orbit admin to connect one Google account owned by each client company. Interview scheduling, conflict checks, and external event visibility use the client attached to the lead. Closers do not authenticate with Google.

## MVP decisions

- One active primary Google Calendar connection per client.
- OAuth is admin-only and carries the selected client ID in signed session state.
- Interview sync uses `lead.companyId`.
- Closers see events from calendars belonging to clients assigned to them.
- File uploads, malware scanning, backups, and production hardening remain deferred.

## Verification

- Focused backend/API/frontend tests cover the calendar and closer dashboard paths.
- Prisma schema generation and the local migration are applied to the running database.
- Admin client-calendar UI and closer dashboard are checked in a real browser on ports 3100/3101.
