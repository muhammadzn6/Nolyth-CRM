# Orbit Placement Journey Repair Design

**Date:** 2026-09-08
**Status:** Approved in chat

## Objective

Make the existing Admin, BD, and Closer workflow reliable from candidate setup through placement. The repair covers only defects reproduced during the live audit: timezone handling, interview and lead state transitions, role-aware navigation, recruiter/contact rendering, structured communication entry, mutation refresh behavior, modal hydration, and KPI consistency.

The existing candidate, profile, lead, interview, offer, placement, authorization, and activity-event models remain the foundation. This work does not add email synchronization, background ingestion, or a new calendar provider.

## Success criteria

1. A datetime entered in an IANA timezone is stored as the correct UTC instant and renders as the same local wall-clock time in that timezone.
2. Interview state moves forward through `SCHEDULED`, `WAITING_FEEDBACK`, and `PASSED` or `FAILED`; cancelled and missed rounds remain distinct.
3. Attendance cannot be recorded before the interview begins.
4. Lead status advances monotonically from application through response, interview, offer, acceptance, placement, and start.
5. Recruiter details saved during intake render correctly on the application page.
6. Closer navigation exposes only permitted destinations, while interviews remain directly discoverable.
7. Existing closer notes and official outcomes are visible after reload and cannot be unknowingly overwritten.
8. Communication records show channel, direction, recruiter, subject, outcome, body, and a human-readable timestamp.
9. Successful modal mutations close the modal and refresh server data without a full browser reload.
10. Dashboard interview and offer labels match the records they count.
11. Regression tests reproduce each audited defect before its fix and pass afterward.

## Datetime ownership

Orbit stores instants in UTC and stores the relevant IANA timezone separately when the domain model supports it.

Interview input is a local wall-clock value interpreted in the selected interview timezone. The default timezone is the candidate profile timezone. The frontend converts that wall-clock value to a UTC ISO instant with a shared, DST-aware utility before calling the existing API. Edit forms convert the stored instant back to a `datetime-local` value in the interview timezone.

Offer decision deadlines are interpreted in the acting user's configured timezone because the current offer model has no deadline timezone field. The offer form receives that timezone explicitly and uses the same conversion utility in both directions. This removes browser-machine timezone dependence without a database migration.

Invalid IANA zones, nonexistent DST wall times, ambiguous conversions, and end-before-start values produce field-level validation errors instead of silent coercion.

## Interview lifecycle

The interview state machine is:

- Creation or reschedule: `SCHEDULED`
- Closer reports a conflict: `RESCHEDULE_REQUIRED`
- Admin or BD cancels: `CANCELLED`
- Closer marks attended: `WAITING_FEEDBACK`
- Closer marks missed: `NO_SHOW`
- Admin or owning BD records a positive official outcome: `PASSED`
- Admin or owning BD records a negative official outcome: `FAILED`

Official outcome entry consists of a required `PASSED` or `FAILED` selection plus optional notes. Existing `officialResult` stores the notes when supplied and otherwise stores a concise status label. An official outcome is accepted only from `WAITING_FEEDBACK`; it cannot move a completed round backward.

Attendance is accepted only when the current instant is at or after `startsAt`. This invariant is enforced by the backend regardless of frontend button state. The frontend also hides or disables premature actions and explains when they become available.

Closer notes remain editable in `WAITING_FEEDBACK`, `PASSED`, and `FAILED`. Forms initialize from the stored value.

## Lead lifecycle

Lead progression is monotonic. Domain mutations advance earlier states but never regress later states:

- An inbound recruiter communication advances `APPLIED` to `RESPONSE_RECEIVED`.
- Creating an interview advances `APPLIED` or `RESPONSE_RECEIVED` to `INTERVIEWING`.
- Creating an offer advances any pre-offer active state to `OFFER_RECEIVED`.
- Accepting an offer advances to `OFFER_ACCEPTED`.
- Confirming a start date advances to `PLACED`.
- Starting the placement advances to `STARTED`.

Internal notes and outbound communications do not imply a recruiter response. Declined offers do not silently close the application; closing remains an explicit workflow.

Each automatic transition writes the existing lead-status transition history and activity event within the mutation transaction where supported.

## Application and role-aware workspace

The application page reads recruiter data from the nested lead-contact response and displays name, title when available, email, role, and primary status.

The workspace navigation includes Interviews for every role that can access the lead. Communications, Comments, and Activity remain visible according to existing profile access. Offers are visible only to Admin and the owning BD because the backend intentionally denies Closer access.

Mutation components use router refresh rather than stale local labels or unconditional full-page reloads. Assigning a Closer immediately refreshes ownership. Adding an application closes its dialog, refreshes the application table, and presents a success notification. The dialog mounts portals only after client hydration, eliminating the server/client mismatch for query-opened dialogs.

Creation actions for applications, communications, comments, interviews, and offers use the existing dialog component. Record lists remain the primary page content. Editing may remain contextual within a record when it is already compact; large create forms do not remain permanently inline.

## Communications

Manual communication capture reflects that most recruiter work happens outside Orbit. A communication records:

- Channel: Email, LinkedIn, phone, job platform, or internal note
- Direction: inbound, outbound, or internal
- Recruiter/contact when available
- Subject when applicable
- Outcome when applicable
- Body
- Occurrence time
- Optional next action and due time when already supported by the contract

The application page renders communications as a chronological conversation timeline. Entries are grouped visually by normalized subject when present, but this repair does not claim provider-grade email threading because Orbit does not store external message or thread identifiers. Internal notes remain visually distinct from recruiter messages.

Subjects and metadata remain visible after save. Timestamps use the acting user's timezone and locale instead of raw ISO strings. Edit controls expose the fields supported by the current update contract and do not imply unsupported channel or direction edits.

## Dashboard semantics

`Upcoming interviews` and calendar readiness count only future rounds in `SCHEDULED` or `RESCHEDULE_REQUIRED`. Waiting-for-feedback, no-show, passed, failed, completed, and cancelled rounds are excluded.

Interview KPIs continue to distinguish unique interview leads from interview rounds. Cancelled rounds remain excluded from active totals.

Offer funnel metrics represent unique leads that reached the offer stage. Labels use `Offer-stage leads` where necessary to avoid implying a count of offer rows. If a screen displays actual offer records, it uses `Offer records` explicitly.

## Error handling and authorization

Backend authorization remains the source of truth. Frontend role-aware navigation prevents dead-end affordances but does not replace backend checks.

Validation errors are displayed next to the relevant action. Unauthorized destinations render the existing access state when reached directly. Mutation failures preserve entered data and do not close dialogs.

## Testing strategy

Implementation follows red-green-refactor in small groups:

1. Unit tests for wall-clock/IANA conversion, including New York daylight-saving dates.
2. Backend service tests for premature attendance, interview transitions, monotonic lead transitions, and analytics filters.
3. Component tests for contact rendering, dialog hydration, note/outcome prefilling, role-aware navigation, modal close and refresh behavior, and communication metadata.
4. Existing unit, lint, typecheck, and production build checks.
5. Full Playwright E2E using Admin, Maya BD, and Noah Closer credentials.
6. A fresh browser journey creates a candidate/profile/application, records an inbound response, schedules an interview in a US timezone, records attendance and outcome, creates and accepts an offer, and confirms placement. Database assertions verify each stored instant and state.

## Compatibility and rollout

No destructive migration is required. Existing interview rows retain their stored instants and statuses; the repair corrects new input and future transitions. Existing `COMPLETED` and `WAITING_FEEDBACK` records remain readable. UI handling accepts all current enum values.

The implementation is limited to files directly involved in the audited workflow. Existing unrelated dirty-worktree changes are preserved.
