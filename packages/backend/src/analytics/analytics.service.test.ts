import { describe, expect, it, vi } from "vitest";

import { AnalyticsService } from "./analytics.service";

const actor = {
  id: "10000000-0000-4000-8000-000000000001",
  displayName: "Orbit Admin",
  email: "admin@orbit.test",
  role: "ADMIN" as const,
  isActive: true,
};

describe("AnalyticsService interview KPIs", () => {
  it("scopes overdue tasks and interview rounds to the selected profile", async () => {
    const profileId = "30000000-0000-4000-8000-000000000001";
    const database = {
      jobLead: { findMany: vi.fn().mockResolvedValue([]) },
      task: { findMany: vi.fn().mockResolvedValue([]) },
      interviewRound: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const service = new AnalyticsService(database as never);

    await service.dashboard(actor, { profileId });

    expect(database.task.findMany).toHaveBeenCalledWith({
      where: { profileId, status: "OPEN" },
    });
    expect(database.interviewRound.findMany).toHaveBeenCalledWith({
      where: { lead: { profileId } },
    });
  });

  it("scopes BD interview metrics to applications owned by that BD", async () => {
    const bdActor = {
      ...actor,
      id: "10000000-0000-4000-8000-000000000002",
      role: "BD" as const,
    };
    const database = {
      jobLead: { findMany: vi.fn().mockResolvedValue([]) },
      task: { findMany: vi.fn().mockResolvedValue([]) },
      interviewRound: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const service = new AnalyticsService(database as never);

    await service.dashboard(bdActor, {});

    expect(database.interviewRound.findMany).toHaveBeenCalledWith({
      where: { lead: { currentOwnerId: bdActor.id } },
    });
  });

  it("returns unique interview leads and non-cancelled round performance separately", async () => {
    const database = {
      jobLead: {
        findMany: vi.fn().mockResolvedValue([
          { id: "lead-a", status: "INTERVIEWING", source: "LINKEDIN", archivedAt: null },
          { id: "lead-b", status: "APPLIED", source: "EMAIL", archivedAt: null },
        ]),
      },
      task: { findMany: vi.fn().mockResolvedValue([]) },
      interviewRound: {
        findMany: vi.fn().mockResolvedValue([
          { leadId: "lead-a", status: "COMPLETED", attendance: "ATTENDED", startsAt: new Date("2026-09-02T12:00:00.000Z") },
          { leadId: "lead-a", status: "SCHEDULED", attendance: null, startsAt: new Date("2026-09-04T12:00:00.000Z") },
          { leadId: "lead-b", status: "CANCELLED", attendance: "ATTENDED", startsAt: new Date("2026-09-05T12:00:00.000Z") },
        ]),
      },
    };
    const service = new AnalyticsService(database as never, () => new Date("2026-09-03T12:00:00.000Z"));

    const dashboard = await service.dashboard(actor, {});

    expect(dashboard.kpis).toMatchObject({
      interviews: 1,
      interviewRounds: 2,
      attendedRounds: 1,
      cancelledRounds: 1,
      averageRoundsPerInterviewLead: 2,
      roundAttendanceRate: 0.5,
    });
    expect(dashboard.upcomingInterviews).toBe(1);
  });

  it("counts only actionable future interviews as upcoming", async () => {
    const future = new Date("2026-09-04T12:00:00.000Z");
    const interviews = ["SCHEDULED", "RESCHEDULE_REQUIRED", "WAITING_FEEDBACK", "NO_SHOW", "PASSED", "FAILED", "COMPLETED", "CANCELLED"]
      .map((status, index) => ({ leadId: `lead-${index}`, status, attendance: null, startsAt: future }));
    const database = {
      jobLead: { findMany: vi.fn().mockResolvedValue([]) },
      task: { findMany: vi.fn().mockResolvedValue([]) },
      interviewRound: { findMany: vi.fn().mockResolvedValue(interviews) },
    };
    const service = new AnalyticsService(database as never, () => new Date("2026-09-03T12:00:00.000Z"));

    const dashboard = await service.dashboard(actor, {});

    expect(dashboard.upcomingInterviews).toBe(2);
  });

  it("does not count an interview starting at the evaluation instant as future", async () => {
    const now = new Date("2026-09-03T12:00:00.000Z");
    const database = {
      jobLead: { findMany: vi.fn().mockResolvedValue([]) },
      task: { findMany: vi.fn().mockResolvedValue([]) },
      interviewRound: {
        findMany: vi.fn().mockResolvedValue([
          { leadId: "lead-now", status: "SCHEDULED", attendance: null, startsAt: now },
        ]),
      },
    };
    const service = new AnalyticsService(database as never, () => now);

    const dashboard = await service.dashboard(actor, {});

    expect(dashboard.upcomingInterviews).toBe(0);
  });
});
