import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Actor } from "../identity/session.service";
import { InterviewsService } from "./interviews.service";

const closer: Actor = {
  id: "00000000-0000-4000-8000-000000000002",
  displayName: "Noah Patel",
  email: "noah@orbit.local",
  role: "CLOSER",
  isActive: true,
};
const bd: Actor = {
  id: "00000000-0000-4000-8000-000000000003",
  displayName: "Maya Brooks",
  email: "maya@orbit.local",
  role: "BD",
  isActive: true,
};

function harness({ startsAt = "2026-09-08T14:00:00.000Z", status = "SCHEDULED", now = "2026-09-08T15:00:00.000Z" } = {}) {
  let row: Record<string, unknown> = {
    id: "20000000-0000-4000-8000-000000000001",
    leadId: "60000000-0000-4000-8000-000000000001",
    roundNumber: 1,
    roundType: "TECHNICAL",
    status,
    closerId: closer.id,
    creatorId: bd.id,
    startsAt: new Date(startsAt),
    endsAt: new Date("2026-09-08T15:00:00.000Z"),
    timezone: "America/New_York",
    originalDatetimeText: "2026-09-08T10:00–2026-09-08T11:00 (America/New_York)",
    interviewer: null,
    meetingLink: null,
    location: null,
    preparationNotes: null,
    closerNotes: null,
    officialFeedback: null,
    officialResult: null,
    attendance: null,
    googleSyncStatus: null,
    version: 1,
    createdAt: new Date("2026-09-01T10:00:00.000Z"),
    updatedAt: new Date("2026-09-01T10:00:00.000Z"),
  };
  const updateMany = vi.fn(async ({ where, data }: { where: { version?: number; status?: string | { in: string[] } }; data: Record<string, unknown> }) => {
    const allowed = typeof where.status === "string" ? row.status === where.status : where.status?.in ? where.status.in.includes(String(row.status)) : true;
    if (where.version !== row.version || !allowed) return { count: 0 };
    row = { ...row, ...data, version: Number(row.version) + 1, updatedAt: new Date(now) };
    return { count: 1 };
  });
  const lead = {
    id: row.leadId,
    profileId: "40000000-0000-4000-8000-000000000001",
    companyId: "30000000-0000-4000-8000-000000000001",
    companyName: "Northstar Labs",
    jobTitle: "Platform Engineer",
    currentOwnerId: bd.id,
    responsibleCloserId: closer.id,
    profile: { candidate: { firstName: "Avery", lastName: "Chen", preferredName: null } },
  };
  const activityCreate = vi.fn(async () => undefined);
  const database = {
    interviewRound: {
      findUnique: vi.fn(async () => row),
      findMany: vi.fn(async () => []),
      updateMany,
    },
    jobLead: { findUnique: vi.fn(async () => lead) },
    activityEvent: { create: activityCreate },
  };
  const authorization = { assertProfileAccess: vi.fn(async () => undefined) };
  return { activityCreate, service: new InterviewsService(database as never, authorization as never, () => new Date(now)), updateMany };
}

describe("InterviewsService lifecycle", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("advances an applied lead when an interview is scheduled", async () => {
    const lead = { id: "60000000-0000-4000-8000-000000000001", profileId: "40000000-0000-4000-8000-000000000001", companyId: "30000000-0000-4000-8000-000000000001", companyName: "Northstar Labs", jobTitle: "Platform Engineer", currentOwnerId: bd.id, status: "APPLIED", profile: { candidate: { firstName: "Avery", lastName: "Chen" } } };
    const row = { id: "20000000-0000-4000-8000-000000000001", leadId: lead.id, roundNumber: 1, roundType: "TECHNICAL", status: "SCHEDULED", closerId: closer.id, creatorId: bd.id, startsAt: new Date("2026-09-09T14:00:00.000Z"), endsAt: new Date("2026-09-09T15:00:00.000Z"), timezone: "America/New_York", originalDatetimeText: "September 9 at 10:00", interviewer: null, meetingLink: null, location: null, preparationNotes: null, closerNotes: null, officialFeedback: null, officialResult: null, attendance: null, googleSyncStatus: null, version: 1, createdAt: new Date(), updatedAt: new Date() };
    const database = {
      jobLead: { findUnique: vi.fn().mockResolvedValue(lead), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      leadStatusTransition: { create: vi.fn().mockResolvedValue(undefined) },
      profileCloserEligibility: { findFirst: vi.fn().mockResolvedValue({ id: "eligible" }) },
      interviewRound: { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue(row) },
      activityEvent: { create: vi.fn().mockResolvedValue(undefined) },
    };
    const service = new InterviewsService(database as never, { assertProfileAccess: vi.fn().mockResolvedValue(undefined) } as never);

    await service.create(bd, lead.id, { closerId: closer.id, roundType: "TECHNICAL", startsAt: "2026-09-09T14:00:00.000Z", endsAt: "2026-09-09T15:00:00.000Z", timezone: "America/New_York", originalDatetimeText: "September 9 at 10:00" });

    expect(database.jobLead.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: lead.id, status: "APPLIED" }), data: expect.objectContaining({ status: "INTERVIEWING" }) }));
    expect(database.leadStatusTransition.create).toHaveBeenCalledWith({ data: expect.objectContaining({ leadId: lead.id, fromStatus: "APPLIED", toStatus: "INTERVIEWING" }) });
  });

  it("scopes a closer calendar by interview assignment rather than application responsibility", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const service = new InterviewsService({ interviewRound: { findMany } } as never, {} as never);

    await service.calendar(closer, {
      from: "2026-09-08T00:00:00.000Z",
      to: "2026-09-15T00:00:00.000Z",
    });

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        closerId: closer.id,
        lead: {},
      }),
    }));
  });

  it("lets a closer read all rounds for a lead when one round is assigned to them", async () => {
    const assignedRound = {
      id: "20000000-0000-4000-8000-000000000010",
      leadId: "60000000-0000-4000-8000-000000000010",
      roundNumber: 2,
      roundType: "TECHNICAL",
      status: "SCHEDULED",
      closerId: closer.id,
      creatorId: bd.id,
      startsAt: new Date("2026-09-10T14:00:00.000Z"),
      endsAt: new Date("2026-09-10T15:00:00.000Z"),
      timezone: "America/New_York",
      originalDatetimeText: "September 10 at 10:00",
      version: 1,
      createdAt: new Date("2026-09-08T10:00:00.000Z"),
      updatedAt: new Date("2026-09-08T10:00:00.000Z"),
    };
    const lead = {
      id: assignedRound.leadId,
      profileId: "40000000-0000-4000-8000-000000000010",
      currentOwnerId: bd.id,
      responsibleCloserId: null,
      profile: { candidate: { firstName: "Avery", lastName: "Chen" } },
    };
    const database = {
      jobLead: { findUnique: vi.fn().mockResolvedValue(lead) },
      interviewRound: {
        findFirst: vi.fn().mockResolvedValue({ id: assignedRound.id }),
        findMany: vi.fn().mockResolvedValue([assignedRound]),
      },
    };
    const service = new InterviewsService(database as never, { assertProfileAccess: vi.fn().mockResolvedValue(undefined) } as never);

    await expect(service.list(closer, lead.id)).resolves.toMatchObject([{ id: assignedRound.id }]);
    expect(database.interviewRound.findFirst).toHaveBeenCalledWith({
      where: { leadId: lead.id, closerId: closer.id },
      select: { id: true },
    });
  });

  it("blocks attendance before the interview starts", async () => {
    const { service, updateMany } = harness({ now: "2026-09-08T13:59:00.000Z" });

    await expect(service.attendance(closer, "20000000-0000-4000-8000-000000000001", "ATTENDED", 1)).rejects.toThrow("before the interview starts");
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("moves attended rounds to waiting feedback", async () => {
    const { activityCreate, service, updateMany } = harness();

    const result = await service.attendance(closer, "20000000-0000-4000-8000-000000000001", "ATTENDED", 1);

    expect(result.status).toBe("WAITING_FEEDBACK");
    expect(result.attendance).toBe("ATTENDED");
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ version: 1, status: { in: ["SCHEDULED", "RESCHEDULE_REQUIRED"] } }) }));
    expect(activityCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ action: "interview.attendance_recorded" }) });
  });

  it("moves missed rounds to no show", async () => {
    const { service } = harness();

    const result = await service.attendance(closer, "20000000-0000-4000-8000-000000000001", "MISSED", 1);

    expect(result.status).toBe("NO_SHOW");
  });

  it("records an official passed outcome without moving the lifecycle backward", async () => {
    const { activityCreate, service, updateMany } = harness({ status: "WAITING_FEEDBACK" });

    const result = await service.officialResult(bd, "20000000-0000-4000-8000-000000000001", "PASSED", "Strong technical round", 1);

    expect(result.status).toBe("PASSED");
    expect(result.officialResult).toBe("PASSED");
    expect(result.officialFeedback).toBe("Strong technical round");
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ version: 1, status: "WAITING_FEEDBACK" }) }));
    expect(activityCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ action: "interview.result_recorded" }) });
  });

  it("rejects an official outcome before attendance is recorded", async () => {
    const { service, updateMany } = harness({ status: "SCHEDULED" });

    await expect(service.officialResult(bd, "20000000-0000-4000-8000-000000000001", "FAILED", undefined, 1)).rejects.toThrow("waiting for official feedback");
    expect(updateMany).not.toHaveBeenCalled();
  });

  it.each(["WAITING_FEEDBACK", "PASSED", "FAILED", "COMPLETED"])("allows closer notes in the %s compatibility state", async (status) => {
    const { activityCreate, service, updateMany } = harness({ status });

    const result = await service.notes(closer, "20000000-0000-4000-8000-000000000001", "Saved closer note", 1);

    expect(result.closerNotes).toBe("Saved closer note");
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ version: 1, status: { in: ["WAITING_FEEDBACK", "PASSED", "FAILED", "COMPLETED"] } }) }));
    expect(activityCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ action: "interview.notes_recorded" }) });
  });

  it("rejects closer notes before attendance", async () => {
    const { service, updateMany } = harness({ status: "SCHEDULED" });

    await expect(service.notes(closer, "20000000-0000-4000-8000-000000000001", "Too early", 1)).rejects.toThrow("after attendance");
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("rejects interview mutations from an inactive closer before writing", async () => {
    const { service, updateMany } = harness({ status: "WAITING_FEEDBACK" });
    const inactiveCloser = { ...closer, isActive: false };

    await expect(service.notes(inactiveCloser, "20000000-0000-4000-8000-000000000001", "Should not persist", 1)).rejects.toThrow();
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("rejects closer notes from a Closer who does not own the round", async () => {
    const { service, updateMany } = harness({ status: "WAITING_FEEDBACK" });
    const otherCloser = { ...closer, id: "00000000-0000-4000-8000-000000000099" };

    await expect(service.notes(otherCloser, "20000000-0000-4000-8000-000000000001", "Should not persist", 1)).rejects.toThrow();
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("rejects an official outcome from a BD who does not own the lead", async () => {
    const { service, updateMany } = harness({ status: "WAITING_FEEDBACK" });
    const otherBd = { ...bd, id: "00000000-0000-4000-8000-000000000098" };

    await expect(service.officialResult(otherBd, "20000000-0000-4000-8000-000000000001", "PASSED", undefined, 1)).rejects.toThrow();
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("does not emit attendance activity when the expected version is stale", async () => {
    const { activityCreate, service, updateMany } = harness();

    await expect(service.attendance(closer, "20000000-0000-4000-8000-000000000001", "ATTENDED", 2)).rejects.toMatchObject({
      code: "STALE_VERSION",
      details: { actualVersion: 1, expectedVersion: 2 },
    });
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ version: 2 }) }));
    expect(activityCreate).not.toHaveBeenCalled();
  });

  it("allows an owning BD to cancel an interview awaiting reschedule", async () => {
    const { activityCreate, service } = harness({ status: "RESCHEDULE_REQUIRED" });

    await expect(service.cancel(bd, "20000000-0000-4000-8000-000000000001", 1, "Recruiter cancelled")).resolves.toMatchObject({ status: "CANCELLED" });
    expect(activityCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ action: "interview.cancelled" }) });
  });

  it("does not let rescheduling move a terminal interview backward", async () => {
    const { service, updateMany } = harness({ status: "PASSED" });

    await expect(service.reschedule(bd, "20000000-0000-4000-8000-000000000001", {
      startsAt: "2026-09-10T14:00:00.000Z",
      endsAt: "2026-09-10T15:00:00.000Z",
      timezone: "America/New_York",
      originalDatetimeText: "2026-09-10T10:00–2026-09-10T11:00 (America/New_York)",
      expectedVersion: 1,
    })).rejects.toThrow("cannot be rescheduled");
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("reschedules an active interview with optimistic locking and activity", async () => {
    const { activityCreate, service, updateMany } = harness({ status: "RESCHEDULE_REQUIRED" });

    await expect(service.reschedule(bd, "20000000-0000-4000-8000-000000000001", {
      startsAt: "2026-09-10T14:00:00.000Z",
      endsAt: "2026-09-10T15:00:00.000Z",
      timezone: "America/New_York",
      originalDatetimeText: "2026-09-10T10:00–2026-09-10T11:00 (America/New_York)",
      expectedVersion: 1,
    })).resolves.toMatchObject({ status: "SCHEDULED", version: 2 });
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        version: 1,
        status: { in: ["SCHEDULED", "RESCHEDULE_REQUIRED"] },
      }),
    }));
    expect(activityCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ action: "interview.rescheduled" }) });
  });

  it("records a closer conflict only from a scheduled interview and emits activity", async () => {
    const scheduled = harness({ status: "SCHEDULED" });

    await expect(scheduled.service.reportConflict(closer, "20000000-0000-4000-8000-000000000001", "Overlapping customer call", undefined, 1)).resolves.toMatchObject({ status: "RESCHEDULE_REQUIRED" });
    expect(scheduled.activityCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ action: "interview.conflict_reported" }) });

    const terminal = harness({ status: "FAILED" });
    await expect(terminal.service.reportConflict(closer, "20000000-0000-4000-8000-000000000001", "Too late", undefined, 1)).rejects.toThrow("cannot report a conflict");
    expect(terminal.updateMany).not.toHaveBeenCalled();
  });
});
