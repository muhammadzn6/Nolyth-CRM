import { renderToStaticMarkup } from "react-dom/server";
import type { AdminBdPerformanceResponse, SessionUser } from "@orbit/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentActorMock = vi.hoisted(() => vi.fn());
const getDashboardMock = vi.hoisted(() => vi.fn());
const getCalendarMock = vi.hoisted(() => vi.fn());
const listActivityMock = vi.hoisted(() => vi.fn());
const listLeadsMock = vi.hoisted(() => vi.fn());
const listUsersMock = vi.hoisted(() => vi.fn());
const fetchMock = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers({ cookie: "orbit_session=token" })) }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("@orbit/config", () => ({ loadWebEnv: () => ({ appBaseUrl: "http://localhost:3100", apiBaseUrl: "http://localhost:3101/api/v1" }) }));
vi.mock("../../components/layout/app-shell", () => ({ AppShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock("../../components/dashboard/dashboard-overview", () => ({ DashboardOverview: ({ adminPerformance, performancePeriod, performanceReassignments = [], performanceReassignmentError }: { adminPerformance?: AdminBdPerformanceResponse; performancePeriod?: string; performanceReassignments?: unknown[]; performanceReassignmentError?: string }) => <p>{adminPerformance ? `admin-performance-${performancePeriod}-${performanceReassignments.length}-${performanceReassignmentError ? "queue-error" : "queue-ready"}` : "no-admin-performance"}</p> }));
vi.mock("../../components/dashboard/closer-dashboard", () => ({ CloserDashboard: () => <p>closer-dashboard</p> }));
vi.mock("../../lib/api-client", () => ({
  ApiClientError: class ApiClientError extends Error {},
  getCurrentActor: getCurrentActorMock,
  getDashboard: getDashboardMock,
  getCloserDashboard: vi.fn(),
  getCalendar: getCalendarMock,
  listActivity: listActivityMock,
  listLeads: listLeadsMock,
  listUsers: listUsersMock,
  listProfiles: vi.fn(),
  listTasks: vi.fn(),
}));

vi.stubGlobal("fetch", fetchMock);

import HomePage from "../../app/page";

const actor: SessionUser = { id: "00000000-0000-4000-8000-000000000001", displayName: "Zohaib Nasir", email: "zohaib@orbit.example", role: "ADMIN", isActive: true };
const performance: AdminBdPerformanceResponse = {
  period: { from: "2026-08-30T00:00:00.000Z", to: "2026-09-06T00:00:00.000Z" },
  team: { qualifiedApplications: 8, targetApplications: 10, rawTargetAttainmentPercent: 80, effectiveTargetAttainmentPercent: 80, recruiterResponses: 3, interviewsScheduled: 2, interviewsNeedingScheduling: 1, followUpSlaCompliancePercent: 100, maturedOutcomeScorePercent: 20, balancedScore: 66, scoreCoverage: "COMPLETE", scoreCoveragePercent: 100 },
  leaderboard: [], buildingBaseline: [], excluded: [],
  quality: { recordHealthRate: 100, adminAuditPassRate: 100, correctionRate: 0, confirmedDuplicateRate: 0, pendingOverrideRate: 0, rejectedOverrideRate: 0, duplicateRate: 0 },
};
const reassignmentQueue = [{
  id: "00000000-0000-4000-8000-000000000301",
  leadId: "00000000-0000-4000-8000-000000000201",
  ownerId: "00000000-0000-4000-8000-000000000101",
  originalOwnerId: "00000000-0000-4000-8000-000000000101",
  status: "NEEDS_REASSIGNMENT",
  recruiterRespondedAt: "2026-09-05T09:00:00.000Z",
  slaStartedAt: "2026-09-05T09:00:00.000Z",
  slaPausedAt: "2026-09-05T09:00:00.000Z",
  slaResumedAt: null,
  slaDueAt: null,
  completedAt: null,
  breachedAt: null,
  adminReassignmentSlaStartedAt: "2026-09-05T09:00:00.000Z",
  adminReassignmentSlaDueAt: "2026-09-05T11:00:00.000Z",
  adminReassignmentBreachedAt: null,
  reassignedAt: null,
  reassignedById: null,
  auditMetadata: null,
  version: 1,
  createdAt: "2026-09-05T09:00:00.000Z",
  updatedAt: "2026-09-05T09:00:00.000Z",
  lead: { id: "00000000-0000-4000-8000-000000000201", profileId: "00000000-0000-4000-8000-000000000401", createdById: "00000000-0000-4000-8000-000000000101", currentOwnerId: "00000000-0000-4000-8000-000000000101", companyName: "Northstar Labs", jobTitle: "Platform Engineer", appliedDate: "2026-08-10", status: "RESPONSE_RECEIVED" },
}];

describe("Admin performance page data", () => {
  beforeEach(() => {
    getCurrentActorMock.mockResolvedValue(actor);
    getDashboardMock.mockResolvedValue({ kpis: {}, breakdowns: { statuses: [], sources: [] }, upcomingInterviews: 0 });
    getCalendarMock.mockResolvedValue([]);
    listActivityMock.mockResolvedValue([]);
    listLeadsMock.mockResolvedValue({ items: [], nextCursor: null });
    listUsersMock.mockResolvedValue([]);
    fetchMock.mockImplementation(async (url: string) => ({ ok: true, json: async () => ({ success: true, data: url.includes("reassignment-queue") ? reassignmentQueue : performance, meta: { requestId: "request" } }) }));
  });

  afterEach(() => vi.clearAllMocks());

  it("loads the Admin-authorized response for the selected period and passes it to the dashboard", async () => {
    const html = renderToStaticMarkup(await HomePage({ searchParams: Promise.resolve({ performancePeriod: "7d" }) }));

    expect(html).toContain("admin-performance-7d-1-queue-ready");
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/performance/admin?"), expect.objectContaining({ cache: "no-store" }));
    expect(fetchMock.mock.calls[0][0]).toContain("from=");
    expect(fetchMock.mock.calls[0][0]).toContain("to=");
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/performance/admin/reassignment-queue"))).toBe(true);
  });

  it("keeps Admin performance available when the reassignment queue cannot be read", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes("reassignment-queue")) throw new Error("Queue unavailable");
      return { ok: true, json: async () => ({ success: true, data: performance, meta: { requestId: "request" } }) };
    });

    const html = renderToStaticMarkup(await HomePage({ searchParams: Promise.resolve({ performancePeriod: "30d" }) }));

    expect(html).toContain("admin-performance-30d-0-queue-error");
  });
});
