import { InterviewRoundModel } from "@/models/interview-round";
import { JobLeadModel } from "@/models/job-lead";
import { getDashboardData } from "@/services/dashboard-service";
import {
  createLeadFixture,
  createProfileFixture,
  createUserFixture,
  toActor,
} from "@/tests/helpers/fixtures";
import { setupTestDatabase } from "@/tests/helpers/database";

setupTestDatabase();

const NOW = new Date("2026-08-30T16:00:00.000Z");

describe("dashboardService", () => {
  async function seedDashboardContext() {
    const admin = await createUserFixture({
      name: "Admin User",
      email: "dashboard-admin@example.com",
      role: "ADMIN",
    });
    const bdOne = await createUserFixture({
      name: "BD One",
      email: "dashboard-bd-one@example.com",
      role: "BD",
    });
    const closerOne = await createUserFixture({
      name: "Closer One",
      email: "dashboard-closer-one@example.com",
      role: "CLOSER",
    });
    const bdTwo = await createUserFixture({
      name: "BD Two",
      email: "dashboard-bd-two@example.com",
      role: "BD",
    });
    const closerTwo = await createUserFixture({
      name: "Closer Two",
      email: "dashboard-closer-two@example.com",
      role: "CLOSER",
    });

    const profileOne = await createProfileFixture({
      name: "Profile One",
      assignedBD: bdOne._id,
      assignedCloser: closerOne._id,
      createdBy: admin._id,
    });
    const profileTwo = await createProfileFixture({
      name: "Profile Two",
      assignedBD: bdTwo._id,
      assignedCloser: closerTwo._id,
      createdBy: admin._id,
    });

    const importantLead = await createLeadFixture({
      profileId: profileOne._id,
      createdBy: bdOne._id,
      companyName: "Important Corp",
      jobTitle: "Platform Engineer",
      jobUrl: "https://example.com/important",
      status: "APPLIED",
      isImportant: true,
      appliedDate: new Date("2026-08-28T12:00:00.000Z"),
    });
    await JobLeadModel.findByIdAndUpdate(importantLead._id, {
      rateAmount: 100,
      rateUnit: "HOURLY",
    });
    const finalRoundLead = await createLeadFixture({
      profileId: profileOne._id,
      createdBy: bdOne._id,
      companyName: "Final Corp",
      jobUrl: "https://example.com/final",
      status: "FINAL_ROUND",
      appliedDate: new Date("2026-08-20T12:00:00.000Z"),
    });
    await JobLeadModel.findByIdAndUpdate(finalRoundLead._id, {
      rateAmount: 208000,
      rateUnit: "YEARLY",
    });
    await createLeadFixture({
      profileId: profileOne._id,
      createdBy: bdOne._id,
      companyName: "Closed Corp",
      jobUrl: "https://example.com/closed",
      status: "CLOSED",
      appliedDate: new Date("2026-08-10T12:00:00.000Z"),
    });
    await createLeadFixture({
      profileId: profileTwo._id,
      createdBy: bdTwo._id,
      companyName: "Other Profile Corp",
      jobUrl: "https://example.com/other",
      status: "IN_PROCESS",
      appliedDate: new Date("2026-08-29T12:00:00.000Z"),
    });

    await InterviewRoundModel.create({
      leadId: finalRoundLead._id,
      profileId: profileOne._id,
      roundNumber: 1,
      roundType: "TECHNICAL",
      scheduledAt: new Date("2026-08-29T14:00:00.000Z"),
      result: "WAITING",
      createdBy: closerOne._id,
      updatedBy: closerOne._id,
    });
    await InterviewRoundModel.create({
      leadId: finalRoundLead._id,
      profileId: profileOne._id,
      roundNumber: 2,
      roundType: "SYSTEM_DESIGN",
      scheduledAt: new Date("2026-09-02T14:00:00.000Z"),
      result: "SCHEDULED",
      createdBy: closerOne._id,
      updatedBy: closerOne._id,
    });

    return {
      admin,
      bdOne,
      closerOne,
      bdTwo,
      profileOne,
      profileTwo,
      importantLead,
      finalRoundLead,
    };
  }

  it("aggregates useful pipeline, trend, job stats, and interview data", async () => {
    const context = await seedDashboardContext();

    const dashboard = await getDashboardData(toActor(context.admin), NOW);

    expect(dashboard.scope.profileCount).toBe(2);
    expect(dashboard.metrics).toEqual({
      activePipeline: 3,
      finalRound: 1,
      importantActive: 1,
      upcomingInterviews: 1,
    });
    expect(
      dashboard.statusDistribution.find((item) => item.status === "CLOSED")?.count,
    ).toBe(1);
    expect(dashboard.applicationTrend).toHaveLength(8);
    expect(dashboard.applicationTrend.at(-1)?.count).toBe(2);
    expect(dashboard.applicationTrend.at(-2)?.count).toBe(1);
    expect(dashboard.jobStats).toMatchObject({
      totalJobs: 4,
      appliedCount: 1,
      appliedRate: 25,
      ratedJobCount: 2,
      averageRateHourly: 100,
      averageRateYearly: 208000,
    });
    expect(dashboard.upcomingInterviews[0]).toMatchObject({
      companyName: "Final Corp",
      roundNumber: 2,
      profileName: "Profile One",
    });
  });

  it("limits BD and Closer dashboards to their assigned profiles", async () => {
    const context = await seedDashboardContext();

    const bdDashboard = await getDashboardData(toActor(context.bdOne), NOW);
    const closerDashboard = await getDashboardData(toActor(context.closerOne), NOW);
    const unrelatedBdDashboard = await getDashboardData(toActor(context.bdTwo), NOW);

    expect(bdDashboard.scope.profileNames).toEqual(["Profile One"]);
    expect(bdDashboard.metrics.activePipeline).toBe(2);
    expect(bdDashboard.metrics.upcomingInterviews).toBe(1);
    expect(closerDashboard.metrics).toEqual(bdDashboard.metrics);

    expect(unrelatedBdDashboard.scope.profileNames).toEqual(["Profile Two"]);
    expect(unrelatedBdDashboard.metrics.activePipeline).toBe(1);
    expect(unrelatedBdDashboard.metrics.upcomingInterviews).toBe(0);
    expect(unrelatedBdDashboard.jobStats.totalJobs).toBe(1);
    expect(unrelatedBdDashboard.jobStats.appliedRate).toBe(0);
  });

  it("returns a complete empty dashboard when the user has no profiles", async () => {
    const bd = await createUserFixture({
      name: "Unassigned BD",
      email: "dashboard-unassigned@example.com",
      role: "BD",
    });

    const dashboard = await getDashboardData(toActor(bd), NOW);

    expect(dashboard.scope.profileCount).toBe(0);
    expect(dashboard.metrics.activePipeline).toBe(0);
    expect(dashboard.statusDistribution).toHaveLength(5);
    expect(dashboard.applicationTrend).toHaveLength(8);
    expect(dashboard.jobStats.totalJobs).toBe(0);
    expect(dashboard.jobStats.appliedRate).toBe(0);
    expect(dashboard.jobStats.ratedJobCount).toBe(0);
    expect(dashboard.jobStats.averageRateHourly).toBeNull();
    expect(dashboard.jobStats.averageRateYearly).toBeNull();
  });
});
