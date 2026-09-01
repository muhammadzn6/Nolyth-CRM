import { listPlatformActivity, listLeadActivity } from "@/services/activity-service";
import { createLead, updateLead } from "@/services/lead-service";
import { createProfileFixture, createUserFixture, listActivityActions, toActor } from "@/tests/helpers/fixtures";
import { setupTestDatabase } from "@/tests/helpers/database";

setupTestDatabase();

describe("activityService", () => {
  it("records activity when a lead is created and when its status changes", async () => {
    const admin = await createUserFixture({
      name: "Admin User",
      email: "activity-admin@example.com",
      role: "ADMIN",
    });
    const bd = await createUserFixture({
      name: "BD User",
      email: "activity-bd@example.com",
      role: "BD",
    });
    const closer = await createUserFixture({
      name: "Closer User",
      email: "activity-closer@example.com",
      role: "CLOSER",
    });

    const profile = await createProfileFixture({
      name: "Activity Profile",
      assignedBD: bd._id,
      assignedCloser: closer._id,
      createdBy: admin._id,
    });

    const lead = (
      await createLead(
        profile._id.toString(),
        {
          companyName: "Audit Corp",
          jobUrl: "https://audit.example.com/job",
        },
        toActor(bd),
      )
    ).lead;

    await updateLead(
      lead.id,
      {
        status: "IN_PROCESS",
      },
      toActor(bd),
    );

    expect(await listActivityActions()).toEqual([
      "LEAD_CREATED",
      "LEAD_STATUS_CHANGED",
    ]);
  });

  it("allows only admins to access platform-wide activity", async () => {
    const admin = await createUserFixture({
      name: "Admin User",
      email: "activity-admin2@example.com",
      role: "ADMIN",
    });
    const bd = await createUserFixture({
      name: "BD User",
      email: "activity-bd2@example.com",
      role: "BD",
    });

    const adminActivity = await listPlatformActivity(toActor(admin));
    expect(adminActivity).toEqual([]);

    await expect(listPlatformActivity(toActor(bd))).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("paginates lead activity newest-first", async () => {
    const admin = await createUserFixture({
      name: "Admin User",
      email: "activity-admin3@example.com",
      role: "ADMIN",
    });
    const bd = await createUserFixture({
      name: "BD User",
      email: "activity-bd3@example.com",
      role: "BD",
    });
    const closer = await createUserFixture({
      name: "Closer User",
      email: "activity-closer3@example.com",
      role: "CLOSER",
    });

    const profile = await createProfileFixture({
      name: "Paginated Activity Profile",
      assignedBD: bd._id,
      assignedCloser: closer._id,
      createdBy: admin._id,
    });

    const lead = (
      await createLead(
        profile._id.toString(),
        {
          companyName: "Paged Corp",
          jobUrl: "https://paged.example.com/job",
        },
        toActor(bd),
      )
    ).lead;

    await updateLead(lead.id, { status: "IN_PROCESS" }, toActor(bd));
    await updateLead(lead.id, { status: "FINAL_ROUND" }, toActor(bd));

    const firstPage = await listLeadActivity(lead.id, { limit: 1 });
    expect(firstPage.items).toHaveLength(1);
    expect(firstPage.hasMore).toBe(true);
    expect(firstPage.nextCursor).toBeTruthy();

    const secondPage = await listLeadActivity(lead.id, {
      limit: 1,
      cursor: firstPage.nextCursor ?? undefined,
    });
    expect(secondPage.items).toHaveLength(1);
    expect(secondPage.items[0]?._id.toString()).not.toBe(firstPage.items[0]?._id.toString());
  });
});
