import { createProfile, getProfileById, listAccessibleProfiles } from "@/services/profile-service";
import { createUserFixture, createProfileFixture, toActor } from "@/tests/helpers/fixtures";
import { setupTestDatabase } from "@/tests/helpers/database";

setupTestDatabase();

describe("profileService", () => {
  it("returns all profiles to admins and only assigned profiles to BD and CLOSER users", async () => {
    const admin = await createUserFixture({
      name: "Admin User",
      email: "admin@example.com",
      role: "ADMIN",
    });
    const bd = await createUserFixture({
      name: "BD User",
      email: "bd@example.com",
      role: "BD",
    });
    const closer = await createUserFixture({
      name: "Closer User",
      email: "closer@example.com",
      role: "CLOSER",
    });
    const otherBd = await createUserFixture({
      name: "Other BD",
      email: "other-bd@example.com",
      role: "BD",
    });
    const otherCloser = await createUserFixture({
      name: "Other Closer",
      email: "other-closer@example.com",
      role: "CLOSER",
    });

    await createProfileFixture({
      name: "Accessible Profile",
      assignedBD: bd._id,
      assignedCloser: closer._id,
      createdBy: admin._id,
    });
    await createProfileFixture({
      name: "Other Profile",
      assignedBD: otherBd._id,
      assignedCloser: otherCloser._id,
      createdBy: admin._id,
    });

    const adminProfiles = await listAccessibleProfiles(toActor(admin));
    const bdProfiles = await listAccessibleProfiles(toActor(bd));
    const closerProfiles = await listAccessibleProfiles(toActor(closer));

    expect(adminProfiles).toHaveLength(2);
    expect(bdProfiles).toHaveLength(1);
    expect(closerProfiles).toHaveLength(1);
    expect(bdProfiles[0]?.name).toBe("Accessible Profile");
    expect(closerProfiles[0]?.name).toBe("Accessible Profile");
  });

  it("does not return an unrelated profile to a BD or CLOSER user", async () => {
    const admin = await createUserFixture({
      name: "Admin User",
      email: "admin2@example.com",
      role: "ADMIN",
    });
    const bd = await createUserFixture({
      name: "BD User",
      email: "bd2@example.com",
      role: "BD",
    });
    const closer = await createUserFixture({
      name: "Closer User",
      email: "closer2@example.com",
      role: "CLOSER",
    });
    const otherBd = await createUserFixture({
      name: "Other BD",
      email: "other-bd2@example.com",
      role: "BD",
    });
    const otherCloser = await createUserFixture({
      name: "Other Closer",
      email: "other-closer2@example.com",
      role: "CLOSER",
    });

    const restrictedProfile = await createProfileFixture({
      name: "Restricted Profile",
      assignedBD: otherBd._id,
      assignedCloser: otherCloser._id,
      createdBy: admin._id,
    });

    await expect(
      getProfileById(restrictedProfile._id.toString(), toActor(bd)),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      getProfileById(restrictedProfile._id.toString(), toActor(closer)),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("rejects invalid role assignments when creating a profile", async () => {
    const admin = await createUserFixture({
      name: "Admin User",
      email: "admin3@example.com",
      role: "ADMIN",
    });
    const bd = await createUserFixture({
      name: "BD User",
      email: "bd3@example.com",
      role: "BD",
    });
    const closer = await createUserFixture({
      name: "Closer User",
      email: "closer3@example.com",
      role: "CLOSER",
    });

    await expect(
      createProfile(
        {
          name: "Broken Profile A",
          assignedBD: closer._id.toString(),
          assignedCloser: closer._id.toString(),
        },
        toActor(admin),
      ),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });

    await expect(
      createProfile(
        {
          name: "Broken Profile B",
          assignedBD: bd._id.toString(),
          assignedCloser: bd._id.toString(),
        },
        toActor(admin),
      ),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});
