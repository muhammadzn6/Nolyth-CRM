# Orbit Fast Operations Visual Redesign

## Goal

Make Orbit feel like a fast, high-clarity operations tool that is easy to scan during long work sessions, with distinct Admin and Closer dashboards and restrained, meaningful color.

## Approved direction

The visual direction is **Fast operations tool**. Orbit should communicate live work queues, upcoming interviews, blockers, and next actions. It must not resemble generic AI-generated SaaS UI.

The design must avoid:

- Generic motivational or filler copy such as “Good morning” or “Stay on top of things”.
- Redundant KPI card mosaics.
- Decorative panels without an action, decision, or useful state.
- Excessive rounded cards, gradients, and ornamental illustrations.
- Repeating the same record in multiple competing sections.
- Low-contrast metadata used for important information.

## Visual system

Use a cool, light operations canvas with high-contrast navy text:

- Background: `#F3F5F7`.
- Surface: `#FFFFFF`.
- Subtle surface: `#F7F8FA`.
- Primary text: `#172338`.
- Secondary text: `#687589`.
- Border: `#DFE4EA`.
- Primary action: `#315DCC`.
- Primary action hover: `#2449A8`.
- Success: pale green surface with dark green text.
- Warning: pale amber surface with dark amber text.
- Danger: pale red surface with dark red text.

Blue is reserved for actions, links, focus, selected controls, and active navigation. Green, amber, and red communicate workflow states only. Status text must remain readable without relying on color alone.

## Layout principles

- Keep one clear page title and one clear primary action.
- Prefer compact summaries and tables over repeated metric cards.
- Use one main workspace container per functional section.
- Use thin dividers, small radii, and minimal shadows.
- Keep calendar controls visible and make the calendar the dominant dashboard workspace.
- Use compact filter controls, including a filter icon where appropriate.
- Maintain responsive horizontal scrolling for dense tables and calendar grids rather than collapsing information into unreadable cards.

## Role dashboards

### Admin

Admin’s first question is: “What needs management across the operation?” The dashboard should show:

- All-calendar schedule with an explicit All calendars scope.
- Active profiles, open applications, interviews, and items needing review as a compact summary.
- Unassigned applications or interviews.
- Scheduling conflicts.
- Pending feedback.
- Recent system mutations.

### Closer

Closer’s first question is: “What is my next call and what do I need to do?” The dashboard should show:

- Personal role-scoped schedule as the primary workspace.
- Day, week, month, and agenda controls.
- Next meeting with candidate, employer, time, and duration.
- Preparation or briefing context.
- Feedback to record.
- Follow-through queue.

Admin and Closer may share primitives, but their dashboards must not be the same layout with different headings.

## Scope

This pass updates shared tokens and visual primitives, the application shell, Admin dashboard, Closer dashboard, calendar presentation, list/table surfaces, profile workspace, and key operational pages. Existing data contracts, permissions, routes, and mutations remain unchanged.

## Failure and accessibility requirements

- Existing loading, empty, unauthorized, and error states remain functional and use the new visual system.
- Primary text and controls must meet WCAG AA contrast targets.
- Statuses must include text labels, not color alone.
- Keyboard focus must remain visible on links, buttons, form controls, calendar controls, and table actions.
- Third-party calendar failures must remain visible as a recoverable state without breaking the dashboard.

## Verification

- Web typecheck must pass.
- Focused component tests must pass for dashboard, calendar, layout, candidates, and profiles.
- Playwright must verify Admin and Closer login, dashboard rendering, calendar scope, calendar view controls, and key links.
- Frontend remains on port `3100` and backend remains on port `3101`; ports `3000` and `3001` are not used.
