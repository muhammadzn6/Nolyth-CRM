import { createLead, queryLeadsByProfile, updateLead } from "@/services/lead-service";
import { ActivityEventModel } from "@/models/activity-event";
import {
  createLeadFixture,
  createProfileFixture,
  createUserFixture,
  toActor,
} from "@/tests/helpers/fixtures";
import { setupTestDatabase } from "@/tests/helpers/database";

setupTestDatabase();

describe("lead workspace query service", () => {
  async function seedWorkspace() {
    const admin = await createUserFixture({
      name: "Admin User",
      email: "workspace-admin@example.com",
      role: "ADMIN",
    });
    const bd = await createUserFixture({
      name: "BD User",
      email: "workspace-bd@example.com",
      role: "BD",
    });
    const closer = await createUserFixture({
      name: "Closer User",
      email: "workspace-closer@example.com",
      role: "CLOSER",
    });
    const otherBd = await createUserFixture({
      name: "Other BD",
      email: "workspace-other-bd@example.com",
      role: "BD",
    });
    const otherCloser = await createUserFixture({
      name: "Other Closer",
      email: "workspace-other-closer@example.com",
      role: "CLOSER",
    });

    const profile = await createProfileFixture({
      name: "Workspace Profile",
      assignedBD: bd._id,
      assignedCloser: closer._id,
      createdBy: admin._id,
    });

    const otherProfile = await createProfileFixture({
      name: "Other Profile",
      assignedBD: otherBd._id,
      assignedCloser: otherCloser._id,
      createdBy: admin._id,
    });

    return { admin, bd, closer, otherBd, profile, otherProfile };
  }

  it("allows authorized BD and admin access while blocking unrelated users", async () => {
    const { admin, bd, otherBd, profile, otherProfile } = await seedWorkspace();

    await createLeadFixture({
      profileId: profile._id,
      createdBy: bd._id,
      companyName: "Google",
      jobUrl: "https://example.com/google",
      status: "APPLIED",
    });

    const adminResult = await queryLeadsByProfile(profile._id.toString(), {}, toActor(admin));
    const bdResult = await queryLeadsByProfile(profile._id.toString(), {}, toActor(bd));

    expect(adminResult.items).toHaveLength(1);
    expect(bdResult.items).toHaveLength(1);

    await expect(
      queryLeadsByProfile(otherProfile._id.toString(), {}, toActor(bd)),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    await expect(
      queryLeadsByProfile(profile._id.toString(), {}, toActor(otherBd)),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("creates leads with only company and URL while inferring server defaults", async () => {
    const { bd, profile } = await seedWorkspace();

    const result = await createLead(
      profile._id.toString(),
      {
        companyName: "Meta",
        jobUrl: "https://example.com/meta",
      },
      toActor(bd),
    );

    expect(result.lead.status).toBe("APPLIED");
    expect(result.lead.appliedDate).toBeTruthy();
    expect(result.lead.companyName).toBe("Meta");

    const events = await ActivityEventModel.find({ action: "LEAD_CREATED" });
    expect(events).toHaveLength(1);
    expect(events[0]?.actorId.toString()).toBe(bd._id.toString());
  });

  it("filters by status and important flag", async () => {
    const { bd, profile } = await seedWorkspace();

    await createLeadFixture({
      profileId: profile._id,
      createdBy: bd._id,
      companyName: "Applied Co",
      jobUrl: "https://example.com/applied",
      status: "APPLIED",
    });

    const importantLead = await createLeadFixture({
      profileId: profile._id,
      createdBy: bd._id,
      companyName: "Important Co",
      jobUrl: "https://example.com/important",
      status: "IN_PROCESS",
    });

    await updateLead(
      importantLead._id.toString(),
      { isImportant: true },
      toActor(bd),
    );

    const applied = await queryLeadsByProfile(
      profile._id.toString(),
      { view: "applied" },
      toActor(bd),
    );
    const important = await queryLeadsByProfile(
      profile._id.toString(),
      { view: "important" },
      toActor(bd),
    );

    expect(applied.items).toHaveLength(1);
    expect(applied.items[0]?.companyName).toBe("Applied Co");
    expect(important.items).toHaveLength(1);
    expect(important.items[0]?.companyName).toBe("Important Co");
  });

  it("searches across the profile regardless of status view", async () => {
    const { bd, profile } = await seedWorkspace();

    await createLeadFixture({
      profileId: profile._id,
      createdBy: bd._id,
      companyName: "Google",
      jobTitle: "AI Engineer",
      jobUrl: "https://example.com/google-ai",
      status: "APPLIED",
    });

    await createLeadFixture({
      profileId: profile._id,
      createdBy: bd._id,
      companyName: "Meta",
      jobUrl: "https://example.com/meta-ml",
      status: "IN_PROCESS",
    });

    const results = await queryLeadsByProfile(
      profile._id.toString(),
      { q: "Google", view: "in_process" },
      toActor(bd),
    );

    expect(results.items).toHaveLength(1);
    expect(results.items[0]?.companyName).toBe("Google");
    expect(results.items[0]?.status).toBe("APPLIED");
  });

  it("paginates lead results", async () => {
    const { bd, profile } = await seedWorkspace();

    for (let index = 0; index < 3; index += 1) {
      await createLeadFixture({
        profileId: profile._id,
        createdBy: bd._id,
        companyName: `Company ${index}`,
        jobUrl: `https://example.com/job-${index}`,
        appliedDate: new Date(Date.now() - index * 60_000),
      });
    }

    const firstPage = await queryLeadsByProfile(
      profile._id.toString(),
      { limit: 2 },
      toActor(bd),
    );

    expect(firstPage.items).toHaveLength(2);
    expect(firstPage.hasMore).toBe(true);
    expect(firstPage.nextCursor).toBeTruthy();

    const secondPage = await queryLeadsByProfile(
      profile._id.toString(),
      { limit: 2, cursor: firstPage.nextCursor ?? undefined },
      toActor(bd),
    );

    expect(secondPage.items).toHaveLength(1);
    expect(secondPage.hasMore).toBe(false);
  });

  it("returns duplicate URL warnings without blocking creation", async () => {
    const { bd, profile } = await seedWorkspace();

    await createLeadFixture({
      profileId: profile._id,
      createdBy: bd._id,
      companyName: "Existing Co",
      jobUrl: "https://example.com/job/",
    });

    const result = await createLead(
      profile._id.toString(),
      {
        companyName: "Another Co",
        jobUrl: "https://example.com/job",
      },
      toActor(bd),
    );

    expect(result.lead.companyName).toBe("Another Co");
    expect(result.warnings[0]?.code).toBe("DUPLICATE_URL");
  });

  it("rejects DEAD without reason and records important toggle activity", async () => {
    const { bd, profile } = await seedWorkspace();

    const lead = await createLeadFixture({
      profileId: profile._id,
      createdBy: bd._id,
      companyName: "Dead Co",
      jobUrl: "https://example.com/dead",
    });

    await expect(
      updateLead(lead._id.toString(), { status: "DEAD" }, toActor(bd)),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });

    await updateLead(
      lead._id.toString(),
      { status: "DEAD", deadReason: "NO_RESPONSE" },
      toActor(bd),
    );

    await updateLead(lead._id.toString(), { isImportant: true }, toActor(bd));

    const actions = await ActivityEventModel.find({ leadId: lead._id }).sort({ createdAt: 1 });
    expect(actions.map((event) => event.action)).toEqual([
      "LEAD_MARKED_DEAD",
      "LEAD_MARKED_IMPORTANT",
    ]);
  });
});
