import { createInterviewRound } from "@/services/interview-round-service";
import { getLeadDetail } from "@/services/lead-detail-service";
import { createLeadFixture, createProfileFixture, createUserFixture, toActor } from "@/tests/helpers/fixtures";
import { setupTestDatabase } from "@/tests/helpers/database";

setupTestDatabase();

describe("leadDetailService", () => {
  it("returns lead detail with round count for authorized users", async () => {
    const admin = await createUserFixture({
      name: "Admin User",
      email: "detail-admin@example.com",
      role: "ADMIN",
    });
    const bd = await createUserFixture({
      name: "BD User",
      email: "detail-bd@example.com",
      role: "BD",
    });
    const closer = await createUserFixture({
      name: "Closer User",
      email: "detail-closer@example.com",
      role: "CLOSER",
    });

    const profile = await createProfileFixture({
      name: "Detail Profile",
      assignedBD: bd._id,
      assignedCloser: closer._id,
      createdBy: admin._id,
    });

    const lead = await createLeadFixture({
      profileId: profile._id,
      createdBy: bd._id,
      companyName: "Detail Corp",
      jobUrl: "https://example.com/detail",
      jobDescription: "Long description",
    });

    await createInterviewRound(
      lead._id.toString(),
      { roundType: "SCREENING", result: "COMPLETED" },
      toActor(bd),
    );

    const detail = await getLeadDetail(lead._id.toString(), toActor(closer));

    expect(detail.companyName).toBe("Detail Corp");
    expect(detail.roundCount).toBe(1);
    expect(detail.jobDescription).toBe("Long description");
    expect(detail.profileId).toBe(profile._id.toString());
  });

  it("denies lead detail for unauthorized users", async () => {
    const admin = await createUserFixture({
      name: "Admin User",
      email: "detail-admin2@example.com",
      role: "ADMIN",
    });
    const bd = await createUserFixture({
      name: "BD User",
      email: "detail-bd2@example.com",
      role: "BD",
    });
    const otherBd = await createUserFixture({
      name: "Other BD",
      email: "detail-other-bd@example.com",
      role: "BD",
    });
    const closer = await createUserFixture({
      name: "Closer User",
      email: "detail-closer2@example.com",
      role: "CLOSER",
    });

    const profile = await createProfileFixture({
      name: "Protected Detail Profile",
      assignedBD: bd._id,
      assignedCloser: closer._id,
      createdBy: admin._id,
    });

    const lead = await createLeadFixture({
      profileId: profile._id,
      createdBy: bd._id,
      companyName: "Protected Detail Corp",
      jobUrl: "https://example.com/protected-detail",
    });

    await expect(getLeadDetail(lead._id.toString(), toActor(otherBd))).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    const adminDetail = await getLeadDetail(lead._id.toString(), toActor(admin));
    expect(adminDetail.companyName).toBe("Protected Detail Corp");
  });
});
