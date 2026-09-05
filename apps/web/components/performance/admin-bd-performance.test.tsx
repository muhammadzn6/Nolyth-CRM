import { renderToStaticMarkup } from "react-dom/server";
import type {
  AdminBdPerformanceResponse,
  PerformanceDrilldownResponse,
  PerformanceFollowUpWithLead,
  UserSummary,
} from "@orbit/contracts";
import { describe, expect, it } from "vitest";

import { BdLeaderboard } from "./bd-leaderboard";
import { BdTeamKpis } from "./bd-team-kpis";
import { BuildingBaseline } from "./building-baseline";
import { QualityControl } from "./quality-control";
import { ReassignmentQueue } from "./reassignment-queue";
import { ScoreDetails } from "./score-details";

const bdId = "00000000-0000-4000-8000-000000000101";
const leadId = "00000000-0000-4000-8000-000000000201";
const followUpId = "00000000-0000-4000-8000-000000000301";

const team: AdminBdPerformanceResponse["team"] = {
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
};

const row: AdminBdPerformanceResponse["leaderboard"][number] = {
  bdId,
  bdName: "Ayesha Khan",
  rank: 1,
  eligible: true,
  qualifiedApplications: 42,
  performance: { ...team, qualifiedApplications: 42, targetApplications: 40, balancedScore: 91.2 },
  eligibilitySection: "OFFICIAL",
  warnings: ["LOW_OUTCOME_SAMPLE"],
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

const baseline: AdminBdPerformanceResponse["buildingBaseline"][number] = {
  ...row,
  bdId: "00000000-0000-4000-8000-000000000102",
  bdName: "Noor Ali",
  rank: null,
  eligible: false,
  eligibilityProgress: 60,
  ineligibilityReason: "INITIAL_MATURITY_WINDOW_NOT_ELAPSED",
  estimatedEligibilityDate: "2026-09-21T09:00:00.000Z",
  eligibilitySection: "BUILDING_BASELINE",
  warnings: ["LOW_APPLICATION_SAMPLE"],
};

const followUp: PerformanceFollowUpWithLead = {
  id: followUpId,
  leadId,
  ownerId: bdId,
  originalOwnerId: bdId,
  status: "ADMIN_REASSIGNMENT_OVERDUE",
  recruiterRespondedAt: "2026-09-04T09:00:00.000Z",
  slaStartedAt: "2026-09-04T09:00:00.000Z",
  slaPausedAt: "2026-09-04T10:00:00.000Z",
  slaResumedAt: null,
  slaDueAt: null,
  completedAt: null,
  breachedAt: null,
  adminReassignmentSlaStartedAt: "2026-09-04T10:00:00.000Z",
  adminReassignmentSlaDueAt: "2026-09-04T12:00:00.000Z",
  adminReassignmentBreachedAt: "2026-09-04T12:01:00.000Z",
  reassignedAt: null,
  reassignedById: null,
  auditMetadata: { source: "leave" },
  version: 2,
  createdAt: "2026-09-04T09:00:00.000Z",
  updatedAt: "2026-09-04T12:01:00.000Z",
  lead: {
    id: leadId,
    profileId: "00000000-0000-4000-8000-000000000401",
    createdById: bdId,
    currentOwnerId: bdId,
    companyName: "Northstar Labs",
    jobTitle: "Platform Engineer",
    appliedDate: "2026-08-10",
    status: "RESPONSE_RECEIVED",
  },
};

const owners: UserSummary[] = [{
  id: "00000000-0000-4000-8000-000000000103",
  displayName: "Mina Shah",
  email: "mina@orbit.example",
  role: "BD",
  isActive: true,
  timezone: "Asia/Karachi",
  lastLoginAt: null,
}];

const drilldown: PerformanceDrilldownResponse = [{ kind: "LEAD", lead: followUp.lead }];

describe("Admin BD performance components", () => {
  it("renders aggregate KPI values with role-safe drill-down links", () => {
    const html = renderToStaticMarkup(<BdTeamKpis performance={team} period="30d" />);

    expect(html).toContain("Qualified applications");
    expect(html).toContain("Target attainment");
    expect(html).toContain("Recruiter responses");
    expect(html).toContain("Interviews scheduled");
    expect(html).toContain("Interviews needing scheduling");
    expect(html).toContain("72");
    expect(html).toContain("102.9%");
    expect(html).toContain("performanceMetric=QUALIFIED_APPLICATIONS");
    expect(html).toContain("performanceMetric=RECRUITER_RESPONSES");
    expect(html).toContain("performanceMetric=INTERVIEWS_SCHEDULED");
    expect(html).toContain("performanceMetric=INTERVIEWS_NEEDING_SCHEDULING");
  });

  it("renders official unique ranks, server-owned component values, coverage, warning, and tie-break details", () => {
    const html = renderToStaticMarkup(<BdLeaderboard rows={[row]} />);

    expect(html).toContain("#1");
    expect(html).toContain("91.2");
    expect(html).toContain("102.9% attainment");
    expect(html).toContain("94% follow-up SLA");
    expect(html).toContain("68% outcomes");
    expect(html).toContain("100% coverage");
    expect(html).toContain("Low outcome sample");
    expect(html).toContain("Tie-break order");
    expect(html).toContain("Score details");
  });

  it("keeps Building Baseline separate without a rank and shows eligibility progress", () => {
    const html = renderToStaticMarkup(<BuildingBaseline rows={[baseline]} />);

    expect(html).toContain("Building baseline");
    expect(html).toContain("60% complete");
    expect(html).toContain("Initial maturity window not elapsed");
    expect(html).toContain("Sep 21, 2026");
    expect(html).not.toContain("#1");
  });

  it("renders the separate quality guardrails without turning them into a score", () => {
    const html = renderToStaticMarkup(<QualityControl quality={row.quality} />);

    expect(html).toContain("Record health");
    expect(html).toContain("Audit pass");
    expect(html).toContain("Correction rate");
    expect(html).toContain("Confirmed duplicate rate");
    expect(html).toContain("Duplicate rate");
    expect(html).toContain("Pending override");
    expect(html).toContain("Rejected override");
    expect(html).toContain("98%");
  });

  it("renders reassignment urgency, paused BD SLA, Admin SLA, audit-safe lead link, and owner action", () => {
    const html = renderToStaticMarkup(
      <ReassignmentQueue followUps={[followUp]} owners={owners} onReassign={async () => undefined} />,
    );

    expect(html).toContain("Admin reassignment overdue");
    expect(html).toContain("BD SLA paused");
    expect(html).toContain("Admin SLA overdue");
    expect(html).toContain(`/leads/${leadId}`);
    expect(html).toContain("Reassign owner");
    expect(html).toContain("Mina Shah");
  });

  it("keeps a queue outage scoped to the reassignment panel", () => {
    const html = renderToStaticMarkup(
      <ReassignmentQueue error="Reassignment queue is temporarily unavailable. Refresh to try again." followUps={[]} owners={owners} onReassign={async () => undefined} />,
    );

    expect(html).toContain("Reassignment queue");
    expect(html).toContain("Reassignment queue is temporarily unavailable. Refresh to try again.");
  });

  it("renders the exact Admin-authorized drill-down records", () => {
    const html = renderToStaticMarkup(<ScoreDetails metric="QUALIFIED_APPLICATIONS" items={drilldown} />);

    expect(html).toContain("Qualified applications");
    expect(html).toContain("Northstar Labs");
    expect(html).toContain("Platform Engineer");
    expect(html).toContain(`/leads/${leadId}`);
    expect(html).toContain("<details");
  });

  it("keeps performance controls and reassignment actions accessible", () => {
    const html = renderToStaticMarkup(<>
      <BdTeamKpis performance={team} period="30d" />
      <BdLeaderboard rows={[row]} />
      <ReassignmentQueue followUps={[followUp]} owners={owners} onReassign={async () => undefined} />
      <ScoreDetails metric="QUALIFIED_APPLICATIONS" items={drilldown} />
    </>);

    expect(html).toContain('aria-label="BD team performance KPIs"');
    expect(html).toContain('aria-label="Performance period"');
    expect(html).toContain('aria-label="BD performance leaderboard"');
    expect(html).toContain('aria-label="Admin reassignment queue"');
    expect(html).toContain(`for="owner-${followUp.id}"`);
    expect(html).toContain('aria-label="Performance score drill-down"');
  });
});
