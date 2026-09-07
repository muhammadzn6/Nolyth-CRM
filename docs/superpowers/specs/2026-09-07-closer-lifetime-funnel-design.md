# Closer Lifetime Funnel Design

## Goal

Add a truthful all-time conversion funnel to the Closer dashboard using the same orange stream language as the BD lifetime funnel.

## Approved attribution

- The funnel is scoped to the signed-in Closer.
- Every stage counts unique job applications, never interview-round rows.
- An application enters the cohort when it is currently assigned to the Closer or has an interview round assigned to that Closer.
- Offers and placements count only when the Closer has recorded `ATTENDED` on at least one interview for that application.
- Offer evidence is an offer record, an offer-stage current status, or an offer-stage status transition.
- Placement evidence is a placement timestamp, a placement-stage current status, or a placement-stage status transition.

## Stages

1. Applications handled
2. Interviews scheduled
3. Calls attended
4. Offers
5. Placements

Each stage is a subset of the previous stage so the stream cannot widen incorrectly. Offers require an attended call and an offer-stage lead status or status history. Placements require the same attended-call attribution and a placement-stage lead status or status history.

## Presentation

- Place the funnel below the Closer's operational sections, so the calendar and immediate work remain primary.
- Reuse the BD funnel's orange stream visual language without coupling the Closer component to BD-specific copy or data.
- Show stage totals and conversion percentages.
- Stop the visible stream at the first zero stage.
- Make each stage a link to the relevant role-scoped records.
- Preserve a usable horizontal layout on narrow screens.

## Verification

- Contract rejects missing or negative totals.
- Backend aggregation is all-time, distinct by application, role-scoped, and enforces attended-call attribution for downstream results.
- Component renders the five stages, truthful zero-state geometry, links, and accessible labels.
- Closer dashboard browser verification confirms placement and responsive layout.
