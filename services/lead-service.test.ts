import { createLead, getLeadById, updateLead } from "@/services/lead-service";
import { createLeadFixture, createProfileFixture, createUserFixture, toActor } from "@/tests/helpers/fixtures";
import { setupTestDatabase } from "@/tests/helpers/database";

setupTestDatabase();

describe("leadService", () => {
  it("creates a lead with APPLIED status, appliedDate, and the correct profile association", async () => {
    const admin = await createUserFixture({
      name: "Admin User",
      email: "lead-admin@example.com",
      role: "ADMIN",
    });
    const bd = await createUserFixture({
      name: "BD User",
      email: "lead-bd@example.com",
      role: "BD",
    });
    const closer = await createUserFixture({
      name: "Closer User",
      email: "lead-closer@example.com",
      role: "CLOSER",
    });

    const profile = await createProfileFixture({
      name: "Lead Profile",
      assignedBD: bd._id,
      assignedCloser: closer._id,
      createdBy: admin._id,
    });

    const result = await createLead(
      profile._id.toString(),
      {
        companyName: "Acme Corp",
        jobUrl: "https://acme.example.com/jobs/123",
      },
      toActor(bd),
    );

    const lead = result.lead;

    expect(lead.status).toBe("APPLIED");
    expect(lead.appliedDate).toBeTruthy();
    expect(lead.companyName).toBe("Acme Corp");

    const fetched = await getLeadById(lead.id, toActor(bd));
    expect(fetched.profileId.toString()).toBe(profile._id.toString());
  });

  it("does not allow a lead to become DEAD without a deadReason", async () => {
    const admin = await createUserFixture({
      name: "Admin User",
      email: "lead-admin2@example.com",
      role: "ADMIN",
    });
    const bd = await createUserFixture({
      name: "BD User",
      email: "lead-bd2@example.com",
      role: "BD",
    });
    const closer = await createUserFixture({
      name: "Closer User",
      email: "lead-closer2@example.com",
      role: "CLOSER",
    });

    const profile = await createProfileFixture({
      name: "Lead Profile",
      assignedBD: bd._id,
      assignedCloser: closer._id,
      createdBy: admin._id,
    });

    const lead = await createLeadFixture({
      profileId: profile._id,
      createdBy: bd._id,
      companyName: "Dead Corp",
      jobUrl: "https://dead.example.com/jobs/456",
    });

    await expect(
      updateLead(
        lead._id.toString(),
        {
          status: "DEAD",
        },
        toActor(bd),
      ),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("prevents unrelated users from reading or mutating a lead", async () => {
    const admin = await createUserFixture({
      name: "Admin User",
      email: "lead-admin3@example.com",
      role: "ADMIN",
    });
    const bd = await createUserFixture({
      name: "BD User",
      email: "lead-bd3@example.com",
      role: "BD",
    });
    const closer = await createUserFixture({
      name: "Closer User",
      email: "lead-closer3@example.com",
      role: "CLOSER",
    });
    const unrelatedBd = await createUserFixture({
      name: "Other BD",
      email: "lead-other-bd@example.com",
      role: "BD",
    });
    const unrelatedCloser = await createUserFixture({
      name: "Other Closer",
      email: "lead-other-closer@example.com",
      role: "CLOSER",
    });

    const profile = await createProfileFixture({
      name: "Protected Lead Profile",
      assignedBD: bd._id,
      assignedCloser: closer._id,
      createdBy: admin._id,
    });

    const unrelatedProfile = await createProfileFixture({
      name: "Unrelated Profile",
      assignedBD: unrelatedBd._id,
      assignedCloser: unrelatedCloser._id,
      createdBy: admin._id,
    });

    const lead = await createLeadFixture({
      profileId: profile._id,
      createdBy: bd._id,
      companyName: "Protected Corp",
      jobUrl: "https://protected.example.com/jobs/789",
    });

    await expect(getLeadById(lead._id.toString(), toActor(unrelatedBd))).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    await expect(
      createLead(
        unrelatedProfile._id.toString(),
        {
          companyName: "Nope Inc",
          jobUrl: "https://nope.example.com/jobs/1",
        },
        toActor(closer),
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    await expect(
      updateLead(
        lead._id.toString(),
        {
          companyName: "Tampered Corp",
        },
        toActor(unrelatedBd),
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
