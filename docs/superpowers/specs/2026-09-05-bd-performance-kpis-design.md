# BD Performance KPIs and Dashboard Design

## Purpose

Orbit measures BD performance around qualified application execution, follow-up discipline, and recruiter outcomes. The system must reward consistent operational performance without hiding low activity, double-penalizing duplicates, or comparing BDs unfairly when their targets or measurable opportunities differ.

This specification defines the approved KPI model and the Admin and BD dashboard information architecture. It does not define production hardening, email provider selection, or browser E2E implementation details.

## Core application rules

An application cannot be saved until all required intake fields are valid:

- Candidate/profile
- Company
- Job title
- JD link
- Recruiter name
- Recruiter email

The applied date is assigned automatically when the record is saved. Incomplete or unsaved attempts do not exist in Orbit and are not counted or tracked.

### Duplicate detection

Duplicate checks are scoped to the same candidate/profile. Different candidates may apply to the same job.

JD links are normalized before comparison by removing tracking parameters such as `utm_source`, LinkedIn tracking parameters, fragments, and trailing slashes while preserving the actual job identifier.

- **Confirmed duplicate:** same profile plus normalized JD link. It may be saved for traceability but receives zero qualified-target credit.
- **Likely duplicate:** same profile plus normalized company plus job title. It may be saved after a warning.
- **Duplicate override:** a BD may override a likely duplicate only with a mandatory reason. It is saved as `Duplicate Override – Pending Review` and receives provisional qualified credit.
- **Approved override:** provisional credit remains.
- **Rejected override:** the record is treated as a duplicate and credit is removed retroactively.

All duplicate decisions and override reasons are auditable.

## Configurable performance rules

Admin manages these rules from one centralized **Performance Rules** page:

- Individual daily target per BD; default 70 applications per working day
- Working days; default Monday–Friday
- Configured public holidays and approved leave
- Follow-up SLA; default 48 business hours
- Admin reassignment SLA; default two business hours
- Application maturity window; default 21 calendar days
- Duplicate lookback period; default six months
- Outcome-stage points
- Outcome scoring and leaderboard settings

Target changes begin automatically on the next working day. Other rule changes use effective dates. Historical scores are calculated using the rules active at the time and are never silently recalculated. Before saving a rule change, Admin sees an impact preview for future calculations and must confirm the change.

## Primary Admin BD KPIs

The Admin dashboard’s BD section begins with aggregate team KPIs:

1. **Qualified applications today** — saved applications receiving qualified credit today.
2. **Team target attainment** — total qualified applications divided by the total assigned BD targets for the selected period. The result is uncapped and shows over-target performance.
3. **Recruiter responses** — applications that received recruiter responses.
4. **Interviews scheduled / needing scheduling** — interviews already entered in the calendar and recruiter responses still requiring interview entry.

Every KPI is clickable and opens the exact underlying records. KPI definitions are available in tooltips.

## Quality control indicators

Quality indicators are separate guardrails. They do not create an additional duplicate penalty and do not replace the performance score:

- **Record Health Rate:** saved records with valid, usable links, standardized company mapping, correct platform detection, valid recruiter email syntax/domain, and no required correction after audit.
- **Admin Audit Pass Rate**
- **Correction Rate**
- **Confirmed Duplicate Rate**
- **Pending Override Rate**
- **Override Rejection Rate**

Duplicate rate uses all successfully saved applications as the denominator:

`(confirmed duplicates + rejected duplicate overrides) / all saved applications × 100`

Approved overrides are not duplicates. Pending overrides appear separately until resolved. Duplicate rate is informational and has no automatic score penalty.

## Balanced Performance Score

The official score is displayed on a 0–100 scale and defaults to a rolling 30-day period:

`Score = (A × 45%) + (F × 25%) + (O × 30%)`

Where:

- `A` is effective qualified-target attainment.
- `F` is follow-up SLA compliance.
- `O` is matured recruiter outcome score.

### Target attainment

Raw attainment remains fully visible and uncapped. Up to 120% attainment uses the normal scoring rate. Above 120%, additional attainment contributes at 25% of the normal rate. Both the 120% threshold and 25% multiplier are Admin-configurable.

Example: 160% raw attainment becomes 130% effective scoring attainment; 200% becomes 140%.

Qualified credit excludes confirmed duplicates and rejected overrides. Pending overrides count provisionally until Admin decision.

### Follow-up SLA

Any logged recruiter communication satisfies a follow-up. The default SLA is 48 business hours, excluding weekends, configured holidays, and approved leave. A status update without a communication does not satisfy the SLA.

If no eligible follow-up obligation exists, `F` is `N/A`; the score excludes that component and rebalances the remaining weights. No-obligation periods receive no automatic 100% credit.

When a recruiter responds during the owner’s approved leave:

- Original BD retains outcome credit.
- Follow-up becomes `Needs Reassignment`.
- Original BD’s follow-up clock is paused.
- Admin Reassignment SLA starts immediately; default two business hours.
- Admin manually reassigns the item; no backup BD is required.
- New owner’s follow-up SLA starts at reassignment time.
- Admin delay affects Admin operational metrics, not either BD’s SLA score.
- A missed reassignment SLA becomes `Admin Reassignment Overdue`, enters the Admin urgent queue, and triggers in-app and email notifications.

### Recruiter outcomes

Only qualified applications older than the configurable maturity window enter outcome calculations. The default maturity window is 21 calendar days and continues through weekends, holidays, and leave.

`Outcome Conversion = positive outcomes from matured qualified applications / all matured qualified applications`

The highest stage reached determines points; points do not accumulate:

- Positive recruiter reply: 1 point
- Screening reached: 2 points
- Interview reached: 3 points
- Offer received: 5 points

Weights are Admin-configurable with effective-date history. No-response and negative responses remain in the denominator and earn zero positive-outcome points. Late responses reopen the original cohort. Confirmed duplicates and rejected overrides are excluded.

If the maturity window has elapsed and a BD has zero matured applications because of insufficient activity, outcome score is 0%, `Low Outcome Sample` is shown, and the BD remains rankable. An audited system outage or approved absence may make outcomes `N/A` only where there is no fair measurable cohort.

### Missing components and coverage

Unavailable components are excluded and remaining weights are normalized:

- All available: 45% / 25% / 30%
- Follow-ups unavailable: Applications 60% / Outcomes 40%
- Outcomes unavailable: Applications 64.3% / Follow-ups 35.7%
- Only applications available: Applications 100%, marked provisional
- Nothing measurable: no score, `Insufficient data`

The dashboard shows `Score Coverage` and measurement status: `Complete`, `Partial measurement`, `Provisional`, or `Insufficient data`.

## Leaderboard eligibility and ranking

The official leaderboard defaults to rolling 30 days. Eligibility requires:

- At least 10 eligible working days
- The initial 21-day maturity window has elapsed

The following are confidence warnings, not eligibility gates:

- Fewer than 20 qualified applications: `Low Application Sample`
- Fewer than 5 matured applications: `Low Outcome Sample`

BDs below the time/maturity gates appear in a separate **Building Baseline** section. They show provisional score when calculable, active days, score coverage, eligibility progress, ineligibility reason, and estimated eligibility date. They never receive a number, medal, or official rank.

Admin may exclude an otherwise eligible BD only with a documented reason. A temporary exception requires a mandatory reason, expiry date, audit history, and `Admin Override / Provisional` badge; it does not receive a normal numbered rank until minimum sample requirements are met.

Ranking uses the Balanced Performance Score, not raw volume:

1. Higher Balanced Performance Score
2. Higher effective qualified-target attainment
3. Higher matured outcome score
4. Higher follow-up SLA compliance
5. Stable alphabetical order by BD name

Every BD receives a unique rank. The leaderboard shows all BD names and qualified counts. Official ranking eligibility and score components are visible when details are opened.

## Admin dashboard layout

The Admin dashboard keeps general operational KPIs separate from BD performance. The BD section appears below the global Admin KPI strip and defaults to rolling 30 days:

- Left: Balanced Performance leaderboard
- Right: Quality control indicators and Admin reassignment queue
- Below: expandable score details and trend charts
- Separate Building Baseline section below the official leaderboard

The Admin view includes team-wide comparison, every BD’s complete KPI breakdown, application-level drill-downs, recruiter details, audit reasons, correction history, override decisions, and reassignment timestamps.

## BD dashboard layout

The BD dashboard is an operational work surface rather than a full calendar dashboard:

1. Daily KPI strip:
   - Qualified applications today
   - Remaining individual target
   - Recruiter responses
   - Interviews to schedule
2. Split operational area:
   - Work queue first: recruiter responses, follow-ups, and scheduling handoffs
   - Recent applications beside it
3. Compact Upcoming Interviews list below the split area. Each row shows candidate, company, job title, date/time, assigned Closer, and calendar status, with `Edit`, `Open application`, and `Open calendar` actions.
4. Personal rolling 30-day score and score coverage
5. Unique team rank and peer leaderboard
6. Personal quality indicators and application-level drill-down
7. Current individual target, working-day status, leave/holiday impact, and next target-change effective date

BD users can see their complete own metrics and records. They can see peer names, qualified counts, Record Health Rate, Audit Pass Rate, and Duplicate Rate, but not peer applications, recruiter details, audit reasons, or correction history.

## Audit and drill-down requirements

The system preserves timestamps and ownership history for:

- Application save and applied-date assignment
- Duplicate detection and normalization
- Override reason, status, approval/rejection, and reviewer
- Recruiter response receipt
- Follow-up SLA start, pause, reassignment, completion, and breach
- Admin reassignment SLA start and breach
- Target/rule versions and effective dates
- Leave, holiday, and working-day decisions
- Score calculation inputs and coverage

Admin KPI cards, leaderboard rows, quality indicators, reassignment alerts, and score components must link to the records behind them. BD drill-down is limited to the BD’s own records.

## Approved defaults

| Rule | Default |
| --- | ---: |
| BD target | 70 qualified applications per working day |
| Working days | Monday–Friday |
| Follow-up SLA | 48 business hours |
| Admin reassignment SLA | 2 business hours |
| Maturity window | 21 calendar days |
| Duplicate lookback | 6 months |
| Official leaderboard | Rolling 30 days |
| Eligibility | 10 eligible working days + maturity window elapsed |
| Outcome points | 1 / 2 / 3 / 5 by highest stage |
| Score weights | 45% / 25% / 30% |
| Over-target slowdown | Above 120% at 25% marginal rate |
