import { renderToStaticMarkup } from "react-dom/server";
import type { AdminBdPerformanceResponse, SessionUser } from "@orbit/contracts";
import { describe, expect, it, vi } from "vitest";

import { DashboardOverview } from "../dashboard/dashboard-overview";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const actor: SessionUser = {
  id: "00000000-0000-4000-8000-000000000001",
  displayName: "Zohaib Nasir",
  email: "zohaib@orbit.example",
  role: "ADMIN",
  isActive: true,
};

const performance: AdminBdPerformanceResponse = {
  period: { from: "2026-08-06T00:00:00.000Z", to: "2026-09-06T00:00:00.000Z" },
  businessTimeZone: "America/New_York",
  team: {
    qualifiedApplications: 72,
    targetApplications: 70,
    rawTargetAttainmentPercent: 102.9,
    effectiveTargetAttainmentPercent: 102.9,
    recruiterResponses: 14,
    interviewsScheduled: 9,
    interviewsNeedingScheduling: 3,
    followUpSlaCompliancePercent: 94,
    maturedOutcomeScorePercent: 68,
    balancedScore: 86.1,
    scoreCoverage: "COMPLETE",
    scoreCoveragePercent: 100,
  },
  leaderboard: [],
  buildingBaseline: [],
  excluded: [],
  quality: {
    recordHealthRate: 98,
    adminAuditPassRate: 96,
    correctionRate: 2,
    confirmedDuplicateRate: 3,
    pendingOverrideRate: 1,
    rejectedOverrideRate: 0,
    duplicateRate: 3,
  },
};

describe("Admin BD performance composition", () => {
  it("uses the configured business timezone for the Admin date and calendar", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-09T02:30:00.000Z"));

    try {
      const html = renderToStaticMarkup(<DashboardOverview actor={actor} adminPerformance={performance} performancePeriod="30d" />);
      expect(html).toContain("Tue, Sep 8, 2026");
      expect(html).not.toContain("Wed, Sep 9, 2026");
    } finally {
      vi.useRealTimers();
    }
  });

  it("composes the server-owned performance section for Admin only", () => {
    const adminHtml = renderToStaticMarkup(<DashboardOverview actor={actor} adminPerformance={performance} performancePeriod="30d" />);
    const bdHtml = renderToStaticMarkup(<DashboardOverview actor={{ ...actor, role: "BD" }} adminPerformance={performance} performancePeriod="30d" />);

    expect(adminHtml).toContain("Team performance");
    expect(adminHtml).toContain("Quality guardrails");
    expect(adminHtml).toContain("Reassignment queue");
    expect(adminHtml).toContain("admin-surface-system");
    expect(bdHtml).not.toContain("Team performance");
  });
});
