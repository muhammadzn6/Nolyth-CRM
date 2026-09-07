# BD Dashboard Card Hierarchy Design

## Goal

Make the BD dashboard a coherent daily operations workspace. Each card must have one primary message, use an explicit time scope, and expose detail without turning the dashboard into a collection of nested cards.

## Information architecture

- Primary row: daily qualified-application progress (60%) beside seven-day cadence and the action queue (40%).
- Secondary row: compact interview calendar and recent applications, equal height with internally scrollable content.
- Tertiary row: one full-width lifetime placement funnel.
- Performance row: personal performance and team leaderboard, equal width.

## Data rules

- Daily qualified progress and today's platform mix use today's business-date data.
- Cadence uses an authoritative seven-day server series.
- Placement journey uses authoritative lifetime stage totals.
- Action-queue counts and visible records use the same server-owned scope.
- The performance-period control affects only performance cards, not daily, seven-day, calendar, or lifetime cards.

## Card anatomy

Every card uses: eyebrow (optional), title, compact scope/action, one dominant visualization or value, then secondary detail. Inner rows are flat; repeated borders, helper paragraphs, and repeated links are removed.

### Daily tracker

- Qualified applications versus the configured target is the dominant ring.
- Replies and interviews are small supporting markers.
- Today's saved applications are shown as one stacked platform bar with a compact legend.

### Cadence and attention

- Cadence shows seven daily bars plus total, average, and peak; the target appears as a quiet reference line.
- Attention is a prioritized flat checklist. Zero-value categories are hidden; response count and preview items must agree.

### Calendar and recents

- Both cards have the same fixed height.
- Calendar retains the compact month/week/day/agenda interaction.
- Recent applications show at most six rows; overflow scrolls inside the card.

### Placement journey

- Connected stages: jobs applied, active jobs, interviews, offers, placements.
- One all-time scope indicator and concise conversion/drop-off context.
- Stage blocks are clickable without repeated “View records” labels.

### Performance

- Personal card leads with balanced score and three weighted component bars.
- Quality indicators are secondary/collapsible and contain no duplicate duplicate-rate row.
- Team leaderboard ranks by qualified applications, shows sequential rank and record-health bar, and uses an em dash when health is unavailable.

## Visual language

Retain Orbit's soft editorial shell and coral/orange accent. Use restrained warm gradients to establish hierarchy, flat inner content, strong numeric contrast, and fixed card geometry. Avoid white-card-inside-white-card composition.

## Acceptance criteria

- No daily, seven-day, selected-period, and lifetime data are mixed.
- Every dashboard card has a clear title, scope, primary visual/value, and restrained supporting detail.
- Long calendar/application content cannot change the row height.
- Selected performance period is URL-backed and survives navigation/refresh.
- Component tests, backend aggregate tests, frontend checks, and Playwright BD-dashboard verification pass.
