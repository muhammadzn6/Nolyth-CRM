# Lead Workspace Design

## Goal

Turn every lead-detail route into one coherent application workspace that stays recognizable across Overview, Interviews, Communications, Comments, Offers, and Activity while fixing the confirmed mobile overflow.

## Approved experience

- Keep the existing Orbit application shell and role permissions.
- Present candidate, profile, company, job title, status, owner, closer, source, and updated time as the workspace identity.
- Use one compact stage rail for the application lifecycle.
- Use one persistent tab row. Overview is the first tab; Closer users do not see Offers.
- Keep section-specific primary actions in the workspace header and open data-entry flows in modals.
- Use a two-column desktop workspace: primary records on the left and compact ownership/people context on the right. Stack to one column on small screens.
- Merge the duplicated Ownership and Interview ownership cards. Changing the responsible Closer is a secondary modal action and cannot submit an unchanged selection.
- Render the job URL as its normalized domain with open and copy affordances; never let a raw URL determine layout width.
- Render recruiter contacts as compact rows on the workspace surface, not cards nested inside cards.
- Keep empty states concise and section-local.

## Responsive and accessibility requirements

- No page-level horizontal overflow at 390 CSS pixels.
- All grid children that contain external text use `min-width: 0`; URLs wrap or truncate inside their own container.
- Tabs may scroll horizontally inside their own navigation region without widening the page.
- Active navigation uses `aria-current="page"`.
- Modal triggers and controls have accessible names, keyboard focus, and disabled no-op states.
- Status and stage meaning is conveyed by text as well as color.

## Data contract

The lead-detail response includes compact, read-only identity summaries for:

- profile and candidate;
- source;
- current BD owner;
- responsible Closer, when assigned.

This keeps role-safe lead rendering server-first and avoids privileged user-directory calls from Closer routes.

## Non-goals

- No change to lead status transition rules.
- No new candidate, offer, communication, comment, or interview mutations.
- No redesign of unrelated directory or dashboard pages.
- No change to backend authorization.

## Verification

- Contract and backend tests prove the enriched detail response.
- Component/route tests prove persistent role-aware tabs, identity hierarchy, and no-op ownership protection.
- Type checking and targeted tests pass.
- Playwright verifies Overview and each permitted tab for BD, Admin, and Closer at desktop and mobile widths, including no horizontal overflow.
