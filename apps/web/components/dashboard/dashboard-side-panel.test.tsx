import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { InterviewSummary } from "@orbit/contracts";

import { DashboardSidePanel } from "./dashboard-side-panel";

describe("DashboardSidePanel", () => {
  it("links scheduling conflicts to the embedded dashboard calendar", () => {
    const interview = {
      id: "50000000-0000-4000-8000-000000000001",
      leadId: "60000000-0000-4000-8000-000000000001",
      roundType: "TECHNICAL",
      roundNumber: 1,
      status: "RESCHEDULE_REQUIRED",
      startsAt: "2026-09-10T14:00:00.000Z",
    } as InterviewSummary;

    const html = renderToStaticMarkup(<DashboardSidePanel activity={[]} interviews={[interview]} tasks={[]} />);

    expect(html).toContain('href="/?calendarView=day"');
    expect(html).not.toContain('href="/calendar"');
  });
});
