import { renderToStaticMarkup } from "react-dom/server";
import type { BdPerformanceResponse, BdWorkQueue, InterviewSummary, LeadSummary, SessionUser } from "@orbit/contracts";
import { describe, expect, it, vi } from "vitest";

import { BdDashboard, placementStageThickness } from "./bd-dashboard";
import { BdPeerRanking } from "../performance/bd-peer-ranking";
import { BdPersonalQuality } from "../performance/bd-personal-quality";

const actor: SessionUser = {
  id: "00000000-0000-4000-8000-000000000101",
  displayName: "Ayesha Khan",
  email: "ayesha@orbit.example",
  role: "BD",
  isActive: true,
};

const performance: BdPerformanceResponse = {
  period: { from: "2026-08-06T00:00:00.000Z", to: "2026-09-05T23:59:59.000Z" },
  currentDailyTarget: 70,
  nextTargetChangeEffectiveAt: "2026-10-01T00:00:00.000Z",
  rank: 2,
  performance: {
    qualifiedApplications: 83,
    targetApplications: 70,
    rawTargetAttainmentPercent: 118.6,
    effectiveTargetAttainmentPercent: 118.6,
    recruiterResponses: 13,
    interviewsScheduled: 7,
    interviewsNeedingScheduling: 3,
    followUpSlaCompliancePercent: 94,
    maturedOutcomeScorePercent: 58,
    balancedScore: 88.4,
    scoreCoverage: "PARTIAL_MEASUREMENT",
    scoreCoveragePercent: 75,
  },
  quality: {
    recordHealthRate: 98,
    adminAuditPassRate: 96,
    correctionRate: 2,
    confirmedDuplicateRate: 3,
    pendingOverrideRate: 1,
    rejectedOverrideRate: 0,
    duplicateRate: 3,
  },
  eligibility: {
    eligible: true,
    eligibilityProgress: 100,
    ineligibilityReason: null,
    estimatedEligibilityDate: null,
    eligibilitySection: "OFFICIAL",
    warnings: ["LOW_APPLICATION_SAMPLE", "LOW_OUTCOME_SAMPLE"],
  },
  peerLeaderboard: [{
    bdId: "00000000-0000-4000-8000-000000000102",
    bdName: "Noor Ali",
    rank: 1,
    qualifiedApplications: 95,
    recordHealthRate: 97,
    adminAuditPassRate: 95,
    duplicateRate: 2,
  }],
};

const applications = [{
  id: "00000000-0000-4000-8000-000000000201",
  profileId: "00000000-0000-4000-8000-000000000301",
  companyName: "Northstar Labs",
  jobTitle: "Platform Engineer",
  status: "RESPONSE_RECEIVED",
  appliedDate: "2026-09-05",
  rawUrl: "https://jobs.example/platform-engineer",
  createdAt: "2026-09-05T10:00:00.000Z",
  updatedAt: "2026-09-05T10:00:00.000Z",
}] as LeadSummary[];

const interviews = [{
  id: "00000000-0000-4000-8000-000000000401",
  leadId: applications[0].id,
  roundNumber: 1,
  roundType: "TECHNICAL",
  startsAt: "2026-09-08T09:00:00.000Z",
  endsAt: "2026-09-08T10:00:00.000Z",
  timezone: "Asia/Karachi",
  status: "SCHEDULED",
  closerId: "00000000-0000-4000-8000-000000000501",
  creatorId: actor.id,
  interviewer: "Jordan Lee",
  location: null,
  meetingLink: null,
  preparationNotes: null,
  closerNotes: null,
  officialFeedback: null,
  officialResult: null,
  attendance: null,
  googleSyncStatus: "SYNCED",
  originalDatetimeText: "September 8, 2026 at 14:00",
  version: 1,
  createdAt: "2026-09-05T10:00:00.000Z",
  updatedAt: "2026-09-05T10:00:00.000Z",
}] as InterviewSummary[];

const workQueue = {
  recruiterResponses: 3,
  activeApplications: 12,
  openFollowUps: 2,
  platformTotals: [{ platform: "linkedin.com", count: 208 }],
  businessTimeZone: "America/New_York",
  todayPlatformTotals: [
    { platform: "linkedin.com", count: 4 },
    { platform: "indeed.com", count: 2 },
  ],
  sevenDayApplicationTotals: [
    { date: "2026-08-31", total: 3, platformTotals: [{ platform: "linkedin.com", count: 3 }] },
    { date: "2026-09-01", total: 5, platformTotals: [{ platform: "linkedin.com", count: 3 }, { platform: "indeed.com", count: 2 }] },
    { date: "2026-09-02", total: 4, platformTotals: [{ platform: "linkedin.com", count: 4 }] },
    { date: "2026-09-03", total: 6, platformTotals: [{ platform: "linkedin.com", count: 5 }, { platform: "indeed.com", count: 1 }] },
    { date: "2026-09-04", total: 8, platformTotals: [{ platform: "linkedin.com", count: 6 }, { platform: "indeed.com", count: 2 }] },
    { date: "2026-09-05", total: 7, platformTotals: [{ platform: "linkedin.com", count: 7 }] },
    { date: "2026-09-06", total: 6, platformTotals: [{ platform: "linkedin.com", count: 4 }, { platform: "indeed.com", count: 2 }] },
  ],
  pipelineTotals: { jobsApplied: 208, activeJobs: 41, interviews: 19, offers: 6, placements: 2 },
} as unknown as BdWorkQueue;

describe("BD performance dashboard", () => {
  it("uses the work queue business timezone for the dashboard date", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-09T02:30:00.000Z"));

    try {
      const html = renderToStaticMarkup(<BdDashboard actor={actor} applications={applications} interviews={interviews} performance={performance} todayPerformance={performance} workQueue={workQueue} />);
      expect(html).toContain("Tue, Sep 8, 2026");
      expect(html).not.toContain("Wed, Sep 9, 2026");
    } finally {
      vi.useRealTimers();
    }
  });

  it("renders server-owned operational and personal performance values with interview quick actions", () => {
    const html = renderToStaticMarkup(<BdDashboard actor={actor} applications={applications} interviews={interviews} performance={performance} performancePeriod="30d" todayPerformance={performance} workQueue={workQueue} />);

    expect(html).toContain("Daily activity tracker");
    expect(html).toContain('aria-label="BD dashboard context"');
    expect(html).toContain("qualified applications");
    expect(html).toContain("Replies");
    expect(html).toContain("Interviews");
    expect(html).toContain("data-testid=\"bd-progress-ring\"");
    expect(html).toContain("BD seven day cadence");
    expect(html).toContain("Jobs applied");
    expect(html).toContain("What needs attention");
    expect(html).toContain("Responses to review");
    expect(html).toContain("Calendar entries needed");
    expect(html).toContain("6 saved today");
    expect(html).toContain("linkedin.com · 4");
    expect(html).not.toContain("linkedin.com · 208");
    expect(html).toContain("208");
    expect(html).toContain("41");
    expect(html).toContain("19");
    expect(html).toContain("6");
    expect(html).toContain("2");
    expect(html).toContain("pipelineStage=APPLIED");
    expect(html).toContain("pipelineStage=ACTIVE");
    expect(html).toContain("pipelineStage=INTERVIEW");
    expect(html).toContain("pipelineStage=OFFER");
    expect(html).toContain("pipelineStage=PLACEMENT");
    expect(html).toContain('data-testid="bd-lifetime-flow"');
    expect(html).toContain('aria-label="Placement flow: Jobs applied 208, Interviews 19, Offers 6, Placements 2"');
    expect(html).toContain('aria-label="41 active jobs now"');
    expect(html.match(/class="bd-lifetime-flow-band/g)).toHaveLength(4);
    expect(html).not.toContain("bd-lifetime-funnel");
    expect(html).toContain("Total");
    expect(html).toContain("Average");
    expect(html).toContain("Peak");
    expect(html).toContain("88.4");
    expect(html).toContain("75% coverage");
    expect(html).toContain("Next target");
    expect(html).toContain("Oct 1, 2026");
    expect(html).toContain("aria-label=\"BD calendar\"");
    expect(html).not.toContain("aria-label=\"BD upcoming interviews\"");
    expect(html).toContain("View your application details");
    expect(html).toContain("performanceMetric=QUALIFIED_APPLICATIONS");
    expect(html).toContain("Ranked by qualified applications");
    expect(html).not.toContain("The API currently provides");
    expect(html).not.toContain("Trend data will populate");
    expect(html).not.toContain("Click the tube");
    expect(html.match(/aria-label="BD seven day activity chart\./g)).toHaveLength(1);
    expect(html).toContain("2026-09-06: 6");
    expect(html).toContain("editorial-surface-feature");
    expect(html).toContain("editorial-surface-grid");
    expect(html).toContain("editorial-surface-alert");
    expect(html).toContain("editorial-surface-lines");
    expect(html).toContain("editorial-surface-soft");
    expect(html).toContain("bd-pulse-panel-orange");
  });

  it("uses the server work-queue totals instead of the bounded recent-preview arrays", () => {
    const html = renderToStaticMarkup(<BdDashboard
      actor={actor}
      applications={applications}
      interviews={interviews}
      performance={performance}
      todayPerformance={performance}
      workQueue={{ ...workQueue, recruiterResponses: 127, activeApplications: 103, openFollowUps: 64 }}
    />);

    expect(html).toContain("127");
    expect(html).toContain("7");
    expect(html).toContain("64");
    expect(html).toContain("linkedin.com · 4");
    expect(html).not.toContain("linkedin.com · 208");
  });

  it("collapses the placement stream completely when no placement exists", () => {
    const html = renderToStaticMarkup(<BdDashboard
      actor={actor}
      applications={applications}
      interviews={interviews}
      performance={performance}
      todayPerformance={performance}
      workQueue={{ ...workQueue, pipelineTotals: { ...workQueue.pipelineTotals, placements: 0 } }}
    />);

    expect(html).toContain("Placements 0");
    expect(html).toContain("zero stages have no strand");
    const streamPaths = [...html.matchAll(/class="bd-lifetime-flow-band[^"]*" d="([^"]+)"/g)].map((match) => match[1]);
    expect(streamPaths).toHaveLength(4);
    expect(streamPaths.every((path) => !path.includes("950"))).toBe(true);
  });

  it("uses proportional thickness while preserving a minimal non-zero strand", () => {
    expect(placementStageThickness(0, 208)).toBe(0);
    expect(placementStageThickness(104, 208)).toBe(80);
    expect(placementStageThickness(2, 208)).toBe(3);
  });

  it("keeps the current active-job snapshot outside the cumulative journey", () => {
    const html = renderToStaticMarkup(<BdDashboard
      actor={actor}
      applications={applications}
      interviews={interviews}
      performance={performance}
      todayPerformance={performance}
      workQueue={{ ...workQueue, pipelineTotals: { jobsApplied: 6, activeJobs: 2, interviews: 4, offers: 3, placements: 2 } }}
    />);

    expect(html).toContain('aria-label="Placement flow: Jobs applied 6, Interviews 4, Offers 3, Placements 2"');
    expect(html).toContain('aria-label="2 active jobs now"');
  });

  it("reconciles every saved platform while grouping the long tail as Other", () => {
    const html = renderToStaticMarkup(<BdDashboard
      actor={actor}
      applications={applications}
      interviews={interviews}
      performance={performance}
      todayPerformance={performance}
      workQueue={{
        ...workQueue,
        todayPlatformTotals: [
          { platform: "linkedin.com", count: 4 },
          { platform: "indeed.com", count: 3 },
          { platform: "glassdoor.com", count: 2 },
          { platform: "email", count: 2 },
          { platform: "referral", count: 1 },
        ],
      }}
    />);

    expect(html).toContain("12 saved today");
    expect(html).toContain("Other · 3");
    expect(html).not.toContain("referral · 1");
  });

  it("caps recent application rows while retaining one route to the full list", () => {
    const manyApplications = Array.from({ length: 8 }, (_, index) => ({
      ...applications[0],
      id: `00000000-0000-4000-8000-0000000002${String(index).padStart(2, "0")}`,
      jobTitle: `Recent application ${index + 1}`,
      status: "APPLIED",
    })) as LeadSummary[];

    const html = renderToStaticMarkup(<BdDashboard actor={actor} applications={manyApplications} interviews={interviews} performance={performance} performancePeriod="7d" todayPerformance={performance} workQueue={workQueue} />);

    expect(html).toContain("Recent application 6");
    expect(html).not.toContain("Recent application 7");
    expect(html.match(/View all/g)).toHaveLength(1);
    expect(html).toContain("7 days");
  });

  it("renders an explicit unavailable performance panel without deriving performance from previews", () => {
    const html = renderToStaticMarkup(<BdDashboard
      actor={actor}
      applications={applications}
      interviews={interviews}
      error="Performance data is temporarily unavailable."
    />);

    expect(html).toContain("Performance data is temporarily unavailable.");
    expect(html).toContain("Personal performance unavailable");
    expect(html).toContain("Recent applications");
  });

  it("renders peer summaries as a numbered leaderboard with only qualified volume and health", () => {
    const peers = [{
      bdId: actor.id,
      bdName: actor.displayName,
      rank: null,
      qualifiedApplications: 83,
      recordHealthRate: 98,
      adminAuditPassRate: 96,
      duplicateRate: 3,
    }, { ...performance.peerLeaderboard[0], rank: null }];
    const html = renderToStaticMarkup(<BdPeerRanking peers={peers} selfBdId={actor.id} />);

    expect(html).toContain("Team leaderboard");
    expect(html).toContain("Ranked by qualified applications");
    expect(html).toContain('aria-label="Position 1"');
    expect(html).toContain('aria-label="Position 2"');
    expect(html).toContain('aria-current="true"');
    expect(html).toContain("Qualified");
    expect(html).toContain("Health");
    expect(html).toContain("Ayesha Khan");
    expect(html).toContain("Noor Ali");
    expect(html).toContain(">95<");
    expect(html).toContain("qualified applications");
    expect(html).not.toContain("Building baseline");
    expect(html).not.toContain("Your rank");
    expect(html).not.toContain("Audit pass");
    expect(html).not.toContain("Duplicate rate");
    expect(html).not.toContain("Score details");
    expect(html).not.toContain("/leads/");
    expect(html).not.toContain("Recruiter");
    expect(html).not.toContain("audit reasons");
  });

  it("renders self-only quality and the current score coverage state", () => {
    const html = renderToStaticMarkup(<BdPersonalQuality performance={performance} performancePeriod="7d" />);

    expect(html).toContain("Personal performance");
    expect(html).toContain("Qualified attainment");
    expect(html).toContain("Follow-up SLA");
    expect(html).toContain("Matured outcomes");
    expect(html).toContain("Partial measurement");
    expect(html).toContain("Low application sample");
    expect(html).toContain("Low outcome sample");
    expect(html).toContain("Record health");
    expect(html.match(/Duplicate rate/g)).toHaveLength(1);
    expect(html).toContain("Your details");
    expect(html).toContain("performancePeriod=7d&amp;performanceMetric=QUALIFIED_APPLICATIONS");
  });

  it.each([
    [{ eligibilitySection: "BUILDING_BASELINE", scoreCoverage: "INSUFFICIENT_DATA" }, "Building baseline"],
    [{ eligibilitySection: "OFFICIAL", scoreCoverage: "INSUFFICIENT_DATA" }, "Insufficient data"],
  ] as const)("renders the %s eligibility state only for the signed-in BD", (state, label) => {
    const html = renderToStaticMarkup(<BdPersonalQuality performance={{
      ...performance,
      performance: { ...performance.performance, scoreCoverage: state.scoreCoverage, scoreCoveragePercent: 0 },
      eligibility: { ...performance.eligibility, eligible: false, eligibilitySection: state.eligibilitySection, ineligibilityReason: "INITIAL_MATURITY_WINDOW_NOT_ELAPSED" },
    }} />);

    expect(html).toContain(label);
    expect(html).toContain("Your details");
  });
});
