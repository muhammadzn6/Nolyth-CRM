import {
  createInterviewRound,
  listInterviewRoundsByLead,
  updateInterviewRound,
} from "@/services/interview-round-service";
import { ActivityEventModel } from "@/models/activity-event";
import {
  createLeadFixture,
  createProfileFixture,
  createUserFixture,
  toActor,
} from "@/tests/helpers/fixtures";
import { setupTestDatabase } from "@/tests/helpers/database";

setupTestDatabase();

describe("interviewRoundService", () => {
  async function seedLeadContext() {
    const admin = await createUserFixture({
      name: "Admin User",
      email: "round-admin@example.com",
      role: "ADMIN",
    });
    const bd = await createUserFixture({
      name: "BD User",
      email: "round-bd@example.com",
      role: "BD",
    });
    const closer = await createUserFixture({
      name: "Closer User",
      email: "round-closer@example.com",
      role: "CLOSER",
    });
    const otherBd = await createUserFixture({
      name: "Other BD",
      email: "round-other-bd@example.com",
      role: "BD",
    });

    const profile = await createProfileFixture({
      name: "Round Profile",
      assignedBD: bd._id,
      assignedCloser: closer._id,
      createdBy: admin._id,
    });

    const lead = await createLeadFixture({
      profileId: profile._id,
      createdBy: bd._id,
      companyName: "Round Corp",
      jobUrl: "https://example.com/round",
    });

    return { admin, bd, closer, otherBd, profile, lead };
  }

  it("assigns sequential round numbers and records activity", async () => {
    const { bd, lead } = await seedLeadContext();

    const roundOne = await createInterviewRound(
      lead._id.toString(),
      { roundType: "SCREENING", result: "COMPLETED" },
      toActor(bd),
    );
    const roundTwo = await createInterviewRound(
      lead._id.toString(),
      { roundType: "TECHNICAL", result: "SCHEDULED" },
      toActor(bd),
    );

    expect(roundOne.roundNumber).toBe(1);
    expect(roundTwo.roundNumber).toBe(2);

    const rounds = await listInterviewRoundsByLead(lead._id.toString(), toActor(bd));
    expect(rounds.map((round) => round.roundNumber)).toEqual([1, 2]);

    const events = await ActivityEventModel.find({ leadId: lead._id }).sort({ createdAt: 1 });
    expect(events.map((event) => event.action)).toEqual([
      "INTERVIEW_ROUND_CREATED",
      "INTERVIEW_ROUND_CREATED",
    ]);
  });

  it("allows closer to create rounds and updates results with activity", async () => {
    const { closer, lead } = await seedLeadContext();

    const round = await createInterviewRound(
      lead._id.toString(),
      { roundType: "TECHNICAL", result: "SCHEDULED" },
      toActor(closer),
    );

    const updated = await updateInterviewRound(
      round.id,
      { result: "PASSED", notes: "Strong system design discussion." },
      toActor(closer),
    );

    expect(updated.result).toBe("PASSED");
    expect(updated.createdByName).toBe("Closer User");

    const resultEvent = await ActivityEventModel.findOne({
      leadId: lead._id,
      action: "INTERVIEW_ROUND_RESULT_CHANGED",
    });
    expect(resultEvent?.oldValue).toMatchObject({ result: "SCHEDULED" });
    expect(resultEvent?.newValue).toMatchObject({ result: "PASSED" });
  });

  it("blocks unauthorized users from creating rounds", async () => {
    const { otherBd, lead } = await seedLeadContext();

    await expect(
      createInterviewRound(
        lead._id.toString(),
        { roundType: "SCREENING" },
        toActor(otherBd),
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("rejects invalid round types and results", async () => {
    const { bd, lead } = await seedLeadContext();

    await expect(
      createInterviewRound(
        lead._id.toString(),
        { roundType: "INVALID" as "SCREENING" },
        toActor(bd),
      ),
    ).rejects.toThrow();

    const round = await createInterviewRound(
      lead._id.toString(),
      { roundType: "TECHNICAL", result: "SCHEDULED" },
      toActor(bd),
    );

    await expect(
      updateInterviewRound(round.id, { result: "INVALID" as "PASSED" }, toActor(bd)),
    ).rejects.toThrow();
  });
});
