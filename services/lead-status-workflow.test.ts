import { ActivityEventModel } from "@/models/activity-event";
import { listLeadActivity } from "@/services/activity-service";
import { updateLead } from "@/services/lead-service";
import { createLeadFixture, createProfileFixture, createUserFixture, toActor } from "@/tests/helpers/fixtures";
import { setupTestDatabase } from "@/tests/helpers/database";

setupTestDatabase();

describe("lead status workflows", () => {
  async function seedLead() {
    const admin = await createUserFixture({
      name: "Admin User",
      email: "status-admin@example.com",
      role: "ADMIN",
    });
    const bd = await createUserFixture({
      name: "BD User",
      email: "status-bd@example.com",
      role: "BD",
    });
    const closer = await createUserFixture({
      name: "Closer User",
      email: "status-closer@example.com",
      role: "CLOSER",
    });

    const profile = await createProfileFixture({
      name: "Status Profile",
      assignedBD: bd._id,
      assignedCloser: closer._id,
      createdBy: admin._id,
    });

    const lead = await createLeadFixture({
      profileId: profile._id,
      createdBy: bd._id,
      companyName: "Status Corp",
      jobUrl: "https://example.com/status",
      status: "APPLIED",
    });

    return { bd, closer, lead };
  }

  it("supports progression through operational statuses", async () => {
    const { bd, lead } = await seedLead();

    await updateLead(lead._id.toString(), { status: "IN_PROCESS" }, toActor(bd));
    await updateLead(lead._id.toString(), { status: "FINAL_ROUND" }, toActor(bd));
    const closed = await updateLead(lead._id.toString(), { status: "CLOSED" }, toActor(bd));

    expect(closed.status).toBe("CLOSED");

    const events = await ActivityEventModel.find({ leadId: lead._id }).sort({ createdAt: 1 });
    const statusActions = events.map((event) => event.action);
    expect(statusActions).toContain("LEAD_STATUS_CHANGED");
    expect(statusActions).toContain("LEAD_CLOSED");
  });

  it("requires deadReason when marking dead and records reason metadata", async () => {
    const { bd, lead } = await seedLead();

    await updateLead(lead._id.toString(), { status: "IN_PROCESS" }, toActor(bd));

    const dead = await updateLead(
      lead._id.toString(),
      { status: "DEAD", deadReason: "REJECTED", deadNotes: "Not a fit" },
      toActor(bd),
    );

    expect(dead.status).toBe("DEAD");
    expect(dead.deadReason).toBe("REJECTED");
    expect(dead.deadNotes).toBe("Not a fit");
  });

  it("allows reopening dead leads and preserves activity history", async () => {
    const { bd, lead } = await seedLead();

    await updateLead(
      lead._id.toString(),
      { status: "DEAD", deadReason: "REJECTED" },
      toActor(bd),
    );
    const reopened = await updateLead(lead._id.toString(), { status: "IN_PROCESS" }, toActor(bd));

    expect(reopened.status).toBe("IN_PROCESS");

    const activity = await listLeadActivity(lead._id.toString());
    expect(activity.items.length).toBeGreaterThanOrEqual(2);
    expect(activity.items[0]?.createdAt).toBeTruthy();
  });
});
