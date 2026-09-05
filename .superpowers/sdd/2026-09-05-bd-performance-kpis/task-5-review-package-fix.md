# Task 5 review-fix package

## Scope

Focused follow-up to `task-5-review-report.md`. This package contains only the performance-rules UI/API client and the minimal Admin history-read contract required to render immutable rule versions. Calendar and Task 6 files are intentionally excluded.

## Resolved findings

1. Future holidays and approved leave/reduced schedules support version-aware edit/delete via the existing API routes. Started-record protections remain server-enforced and their returned message is displayed in the UI.
2. Admins can read effective-date rule history through `GET /performance/rules/history`; versions are ordered and rendered with effective range, editor, and audit metadata.
3. Bounded numeric/timezone inputs provide native maximums plus per-field accessible validation feedback.

## Regression coverage

- API client: versioned holiday/leave mutations and rule-history read.
- Admin form: future edit/delete, historical-protection error display, ordered history, and accessible bounded-field validation.
- Service/controller: Admin-protected ordered history contract.

## Scope guard

The commit is assembled from an isolated index containing only the eight files listed in the Task 5 report's review-fix verification.
