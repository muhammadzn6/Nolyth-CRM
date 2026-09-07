# Orbit Frontend Visual System Design

## Objective

Turn Orbit into a calm, high-contrast placement operations workspace inspired by the supplied soft editorial dashboard reference. Preserve Orbit's real workflows and KPIs; change the hierarchy, density, interaction model, and visual language.

## Approved direction

- Use a compact persistent icon rail that expands to reveal labels.
- Use one integrated command header: navigation, Orbit/workspace identity, role-aware quick add, global search, notifications, and account controls.
- Keep the workspace directly on the warm-grey page background. Do not add a giant rounded application canvas around the whole product.
- Use asymmetric dashboard composition. The role's primary workflow owns 55–65% of the first viewport; context and diagnostics use the remaining space.
- Prefer visual measures over rows of equal KPI cards: progress rings, segmented bars, stage funnels, cadence bars, compact calendars, dot matrices, and ranking bars.
- Use centered modal dialogs for create and edit actions. Management pages remain browse-first and show saved records in structured tables or lists.
- Keep the product operational and explicit where safety matters, but remove repetitive helper copy and implementation commentary.

## Visual language

### Colour

- Workspace background: `#F1F0EE`.
- Primary surface: `#FFFFFF`.
- Secondary surface: `#F7F7F5`.
- Primary text: `#111827`.
- Muted text: `#697180`.
- Orbit blue: navigation, selection, links, primary actions, and data focus.
- Coral: overdue, urgent, conflict, and destructive states only.
- Green: successful completion only.
- Amber: pending review, scheduling risk, and warning states.

### Shape and elevation

- Rail and primary panels may use 24–30px radii.
- Internal rows and controls use 12–16px radii.
- Pills are reserved for statuses, compact filters, and singular primary actions.
- Use three surface levels only: page, primary panel, inset/secondary region.
- Avoid putting bordered cards inside bordered cards. Prefer dividers, tint, spacing, or a single inset region.
- Shadows are soft and low-opacity. Borders remain visible enough to separate adjacent white surfaces.

### Typography and spacing

- Use strong dark headings with compact line height and restrained tracking.
- Keep supporting copy smaller and lighter, but at accessible contrast.
- Use tabular numerals for KPIs, targets, timestamps, and rankings.
- Reduce repeated labels and explanatory paragraphs. Use tooltips or disclosure controls for definitions.
- Desktop page width remains fluid up to 1600px; mobile puts the role's primary action and page identity in the first screen.

## Shared shell

### Compact expandable rail

- Desktop: 72px collapsed rail, 224px expanded rail.
- The Orbit mark stays visible in both states.
- A role-aware quick-add button is the first action.
- Navigation uses icons in both states and labels only when expanded.
- The active route is a dark, high-contrast lozenge; hover is a quiet secondary tint.
- Groups appear only in expanded mode.
- Mobile: the rail becomes a dismissible drawer; the header menu button opens it.

### Integrated command header

- One low-height surface aligned with the rail.
- Always show page identity, including on mobile.
- Show role/workspace context without repeating a dashboard hero.
- Desktop search is central and uses `Cmd+K` as a discoverable shortcut label.
- Role-aware quick add opens a compact menu:
  - Admin: candidate, profile, user, interview.
  - BD: application, recruiter response, communication.
  - Closer: interview outcome, feedback, task.
- Existing routes remain the source of truth. Quick-add actions deep-link to route-level modal state such as `?new=application`.

## Dialog and data-entry model

- A shared accessible dialog primitive supplies the backdrop, focus entry, Escape handling, labelled title, and scroll containment.
- Create forms are not permanently visible on management pages.
- Dialog forms are flat: no extra card inside the dialog.
- Required fields are visually clear; validation appears beside the affected field and in an accessible live region.
- Successful creation closes the dialog where the existing API flow supports it and updates or reloads the visible record collection.
- Destructive actions use a smaller confirmation dialog.
- On mobile dialogs become near-full-width, retain visible close controls, and keep the primary action reachable.

## Role dashboards

### Admin

- First viewport: compact operational pulse, dominant team calendar, and needs-attention queue.
- Keep applications, interviews, calls, overdue actions, conflicts, and offers/placements as clickable metrics.
- Use a connected placement funnel, source mix bars, activity timeline, BD leaderboard, quality guardrails, reassignment queue, and baseline section below the operational area.
- Do not show an employer-directory promotional card as a dashboard KPI.

### BD

- First viewport: daily qualified-application tracker (dominant), seven-day cadence, and actionable queue.
- Daily progress is the primary visual, with target, remaining count, replies, interviews, and platform mix.
- Calendar is secondary and compact; recent applications shares the same fixed height and scroll behaviour.
- Lifetime funnel and real seven-day volume are below the fold.
- Remove fabricated trend lines, unavailable dash-only metric cards, API implementation notes, and duplicate cadence charts.
- Keep personal quality and peer ranking as lower diagnostic panels.

### Closer

- First viewport is calendar-first. Do not place equal KPI cards or a large greeting ahead of the calendar.
- Pair the calendar with the next-meeting briefing and compact readiness/attention information.
- Below the calendar show assigned applications, outcome/feedback queue, and recent activity without duplicating notifications.
- Existing role scope and candidate-calendar behaviour remain unchanged.

## Management pages

- Candidates, profiles, leads, users, tasks, activity, analytics, and employer records use a shared browse-first page rhythm: page title, compact summary, toolbar, primary data surface.
- Search/filter/sort controls belong in one toolbar rather than separate cards.
- Create/import actions open dialogs.
- Tables use sticky or visually distinct headers, compact rows, clear status, and a single row action entry point.
- Long collections are paginated or constrained with internal scrolling; the page must not render dozens of independent edit cards.
- Tasks group by urgency/status and keep completion/cancellation actions visually secondary to the task title.
- Analytics uses funnel/bars/distribution visuals instead of eight equal number cards.
- Activity groups entries by date and offers type/actor filters.

## Interaction and accessibility

- Keyboard access for rail, quick-add menu, account menu, dialogs, calendar controls, and row actions.
- Focus indicators use Orbit blue and remain visible on warm-grey and white surfaces.
- Minimum 44px touch targets for primary mobile controls.
- Respect reduced motion. Motion is limited to state changes, menu/dialog entry, progress, and hover lift.
- Empty, loading, error, and retry states preserve layout and explain the next action without exposing implementation details.

## Verification targets

- Existing frontend test baseline remains green.
- New component tests cover the expandable rail, role-aware quick add, dialog dismissal/focus, and popup-oriented management flows.
- Typecheck, lint, and production build pass.
- Playwright validates Admin, BD, and Closer at 1440×1000 and 390×844.
- Browser console has no application hydration errors, uncaught exceptions, or failed same-origin API requests during the audited flows.
- Frontend remains on `http://localhost:3100`; backend remains on `http://localhost:3101`.
