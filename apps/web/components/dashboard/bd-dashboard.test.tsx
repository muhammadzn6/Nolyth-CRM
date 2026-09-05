import { renderToStaticMarkup } from "react-dom/server";
import type { BdPerformanceResponse, InterviewSummary, LeadSummary, SessionUser } from "@orbit/contracts";
import { describe, expect, it } from "vitest";

import { BdDashboard } from "./bd-dashboard";
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

describe("BD performance dashboard", () => {
  it("renders server-owned operational and personal performance values with interview quick actions", () => {
    const html = renderToStaticMarkup(<BdDashboard actor={actor} applications={applications} interviews={interviews} performance={performance} />);

    expect(html).toContain("Qualified applications today");
    expect(html).toContain("Remaining target");
    expect(html).toContain("Recruiter responses");
    expect(html).toContain("Interviews to schedule");
    expect(html).toContain("88.4");
    expect(html).toContain("75% coverage");
    expect(html).toContain("Next target");
    expect(html).toContain("Oct 1, 2026");
    expect(html).toContain("Upcoming interviews");
    expect(html).toContain("Edit");
    expect(html).toContain("Open application");
    expect(html).toContain("Open calendar");
    expect(html).toContain("View your application details");
    expect(html).toContain("performanceMetric=QUALIFIED_APPLICATIONS");
  });

  it("uses the server work-queue totals instead of the bounded recent-preview arrays", () => {
    const html = renderToStaticMarkup(<BdDashboard
      actor={actor}
      applications={applications}
      interviews={interviews}
      performance={performance}
      todayPerformance={performance}
      workQueue={{ recruiterResponses: 127, activeApplications: 103, openFollowUps: 64, platformTotals: [{ platform: "linkedin.com", count: 208 }] }}
    />);

    expect(html).toContain("127");
    expect(html).toContain("103");
    expect(html).toContain("64 tasks");
    expect(html).toContain("208 total");
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

  it("keeps peer summaries to the approved fields and has no peer detail links", () => {
    const html = renderToStaticMarkup(<BdPeerRanking peers={performance.peerLeaderboard} selfRank={performance.rank} />);

    expect(html).toContain("Noor Ali");
    expect(html).toContain("95 qualified applications");
    expect(html).toContain("Record health");
    expect(html).toContain("Audit pass");
    expect(html).toContain("Duplicate rate");
    expect(html).not.toContain("Score details");
    expect(html).not.toContain("/leads/");
    expect(html).not.toContain("Recruiter");
    expect(html).not.toContain("audit reasons");
  });

  it("renders self-only quality and the current score coverage state", () => {
    const html = renderToStaticMarkup(<BdPersonalQuality performance={performance} />);

    expect(html).toContain("Personal performance");
    expect(html).toContain("Partial measurement");
    expect(html).toContain("Low application sample");
    expect(html).toContain("Low outcome sample");
    expect(html).toContain("Record health");
    expect(html).toContain("Your details");
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
