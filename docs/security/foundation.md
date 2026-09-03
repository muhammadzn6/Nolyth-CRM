# Foundation security boundary

This document describes controls present in the current foundation. It is not a production security attestation and does not claim the approved OWASP ASVS Level 2 target has been met.

## Present now

- Argon2id password hashing and constant-work verification for missing, inactive, or unusable accounts
- generic invalid-login responses
- random session tokens with only HMAC hashes stored in PostgreSQL
- secure, HTTP-only, SameSite session cookies and server-side logout revocation
- active-account checks at session use
- strict login payload validation and unknown-field rejection
- exact trusted-origin checks on login/logout plus one-origin credentialed CORS
- exact trusted-origin checks on admin user mutations and invitation acceptance
- admin-only user creation, role changes, activation changes, and session revocation
- one-time expiring invitation tokens stored only as hashes; plaintext invitation tokens are returned once and are not logged or persisted
- invitation acceptance that lets the invited user set their own password without exposing it to administrators
- deactivation and explicit session-revocation paths that invalidate active sessions server-side
- request IDs and redacted unexpected API errors
- CSP, frame denial, MIME sniffing denial, restrictive referrer/permissions headers, and HSTS headers
- server/browser environment separation; only `NEXT_PUBLIC_*` values enter browser configuration
- no committed admin password; seed credentials are operator-supplied and rotated
- safe structured worker logs that record error types rather than payloads or secrets
- authorization-sensitive worker state rechecks, idempotency, bounded retries, and recoverable leases

## Not complete

The foundation does not yet provide password reset/change or resend-invitation flows, login rate limits/lockout, compromised-password screening, MFA/SSO, a production CSP nonce strategy, file validation/scanning, signed object access, production provider credentials/adapters, immutable database-role enforcement, secrets-manager integration/rotation, dependency/secret/container/dynamic scans, comprehensive authorization tests for target domains, audit administration, monitoring/alerting, penetration testing, or backup/restore evidence.

Local and CI credentials are disposable. Never reuse `.env.example`, Compose, seed, or workflow values in a deployed environment. Do not print environment files, seed passwords, invitation tokens, session tokens, provider payloads, or production data in logs. Production work must use distinct runtime and migration identities and environment-specific secrets.

Security hardening remains a separate target-domain plan and release gate.
