import { describe, expect, it, vi } from "vitest";

import { AuthorizationError } from "../errors/app-error";
import { LeadsService } from "./leads.service";

const closer = {
  id: "10000000-0000-4000-8000-000000000001",
  displayName: "Closer User",
  email: "closer@orbit.test",
  role: "CLOSER" as const,
  isActive: true,
};

const bd = {
  id: "10000000-0000-4000-8000-000000000002",
  displayName: "BD User",
  email: "bd@orbit.test",
  role: "BD" as const,
  isActive: true,
};

describe("LeadsService authorization", () => {
  it("hydrates the identities required by the lead workspace", async () => {
    const lead = {
      id: "30000000-0000-4000-8000-000000000010",
      profileId: "50000000-0000-4000-8000-000000000010",
      companyId: "60000000-0000-4000-8000-000000000010",
      sourceId: "70000000-0000-4000-8000-000000000010",
      createdById: bd.id,
      currentOwnerId: bd.id,
      responsibleCloserId: closer.id,
      archivedById: null,
      closedById: null,
      jobTitle: "Platform Engineer",
      companyName: "Northstar Labs",
      description: null,
      rawUrl: "https://jobs.example.test/42",
      canonicalUrl: "https://jobs.example.test/42",
      canonicalHash: "jobs.example.test/42",
      location: null,
      workplaceType: null,
      employmentType: null,
      contractType: null,
      compensationMin: null,
      compensationMax: null,
      compensationCurrency: null,
      compensationPeriod: null,
      appliedDate: new Date("2026-09-05T00:00:00.000Z"),
      status: "INTERVIEWING",
      isImportant: false,
      closureReason: null,
      closureNotes: null,
      closedAt: null,
      placedAt: null,
      startDate: null,
      startedAt: null,
      archivedAt: null,
      archiveReason: null,
      createdAt: new Date("2026-09-05T12:00:00.000Z"),
      updatedAt: new Date("2026-09-08T12:00:00.000Z"),
      version: 2,
    };
    const hydrated = {
      ...lead,
      company: {
        id: lead.companyId,
        canonicalName: "Northstar Labs",
        website: "https://northstar.example",
        domain: "northstar.example",
        industry: null,
        location: null,
        createdAt: new Date("2026-09-01T12:00:00.000Z"),
        updatedAt: new Date("2026-09-01T12:00:00.000Z"),
        version: 1,
      },
      profile: {
        id: lead.profileId,
        name: "Avery Chen — Platform Engineer",
        candidate: {
          id: "80000000-0000-4000-8000-000000000010",
          firstName: "Avery",
          lastName: "Chen",
          preferredName: null,
        },
      },
      sourceRef: { id: lead.sourceId, name: "LinkedIn" },
      currentOwner: bd,
      responsibleCloser: closer,
      contacts: [],
    };
    const findUnique = vi.fn().mockResolvedValueOnce(lead).mockResolvedValueOnce(hydrated);
    const authorization = { assertProfileAccess: vi.fn().mockResolvedValue(undefined) };
    const service = new LeadsService({ jobLead: { findUnique } } as never, authorization as never);

    const result = await service.get(bd, lead.id);

    expect(findUnique).toHaveBeenNthCalledWith(2, {
      where: { id: lead.id },
      include: {
        company: true,
        contacts: { include: { contact: true } },
        currentOwner: true,
        profile: { include: { candidate: true } },
        responsibleCloser: true,
        sourceRef: true,
      },
    });
    expect(result).toMatchObject({
      profile: { name: "Avery Chen — Platform Engineer", candidate: { firstName: "Avery", lastName: "Chen" } },
      sourceRef: { name: "LinkedIn" },
      currentOwner: { displayName: "BD User" },
      responsibleCloser: { displayName: "Closer User" },
    });
  });

  it("lets a BD drill into historically reached stages for applications they submitted", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const service = new LeadsService({ jobLead: { findMany } } as never, { assertProfileAccess: vi.fn() } as never);

    await expect(service.list(bd, { pipelineStage: "OFFER", archived: false, limit: 50 })).resolves.toEqual({ items: [], nextCursor: null });

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        createdById: bd.id,
        OR: expect.arrayContaining([
          { status: { in: ["OFFER_RECEIVED", "OFFER_ACCEPTED", "PLACED", "STARTED"] } },
          { statusTransitions: { some: { toStatus: { in: ["OFFER_RECEIVED", "OFFER_ACCEPTED", "PLACED", "STARTED"] } } } },
        ]),
      }),
    }));
  });

  it("requires BDs to use strict application intake instead of generic lead creation", async () => {
    const database = {
      jobLead: { create: vi.fn() },
      company: { findUnique: vi.fn() },
      jobSource: { findUnique: vi.fn() },
      activityEvent: { create: vi.fn() },
    };
    const authorization = { assertProfileAccess: vi.fn().mockResolvedValue(undefined) };
    const service = new LeadsService(database as never, authorization as never);

    await expect(service.create(bd, {
      profileId: "50000000-0000-4000-8000-000000000001",
      companyId: "60000000-0000-4000-8000-000000000001",
      currentOwnerId: bd.id,
      sourceId: "70000000-0000-4000-8000-000000000001",
      jobTitle: "Platform Engineer",
      rawUrl: "https://jobs.example.test/42",
      appliedDate: "2026-09-05",
    })).rejects.toEqual(new AuthorizationError());
    expect(database.jobLead.create).not.toHaveBeenCalled();
  });

  it("does not allow a closer to open an unassigned lead by URL", async () => {
    const lead = {
      id: "30000000-0000-4000-8000-000000000001",
      profileId: "50000000-0000-4000-8000-000000000001",
      responsibleCloserId: "10000000-0000-4000-8000-000000000009",
    };
    const database = {
      jobLead: {
        findUnique: vi.fn().mockResolvedValue(lead),
      },
      interviewRound: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };
    const authorization = {
      assertProfileAccess: vi.fn().mockResolvedValue(undefined),
    };
    const service = new LeadsService(database as never, authorization as never);

    await expect(service.get(closer, lead.id)).rejects.toEqual(new AuthorizationError());
    expect(authorization.assertProfileAccess).toHaveBeenCalledWith(closer, lead.profileId);
    expect(database.jobLead.findUnique).toHaveBeenCalledTimes(1);
  });

  it("lets a closer list an application when they are assigned to one of its interview rounds", async () => {
    const lead = {
      id: "30000000-0000-4000-8000-000000000011",
      profileId: "50000000-0000-4000-8000-000000000011",
      companyId: "60000000-0000-4000-8000-000000000011",
      sourceId: "70000000-0000-4000-8000-000000000011",
      createdById: bd.id,
      currentOwnerId: bd.id,
      responsibleCloserId: null,
      jobTitle: "Journey QA Engineer",
      rawUrl: "https://jobs.example.test/qa-11",
      appliedDate: new Date("2026-09-08T00:00:00.000Z"),
      status: "INTERVIEWING",
      isImportant: false,
      createdAt: new Date("2026-09-08T10:00:00.000Z"),
      updatedAt: new Date("2026-09-08T10:00:00.000Z"),
      version: 1,
    };
    const findMany = vi.fn().mockResolvedValue([lead]);
    const service = new LeadsService({ jobLead: { findMany } } as never, { assertProfileAccess: vi.fn() } as never);

    const result = await service.list(closer, { archived: false, limit: 50 });

    expect(result.items.map((item) => item.id)).toEqual([lead.id]);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        AND: [{
          OR: [
            { responsibleCloserId: closer.id },
            { interviews: { some: { closerId: closer.id } } },
          ],
        }],
      }),
    }));
  });

  it("lets a closer open an application when they are assigned to one of its interview rounds", async () => {
    const lead = {
      id: "30000000-0000-4000-8000-000000000012",
      profileId: "50000000-0000-4000-8000-000000000012",
      companyId: "60000000-0000-4000-8000-000000000012",
      sourceId: "70000000-0000-4000-8000-000000000012",
      createdById: bd.id,
      currentOwnerId: bd.id,
      responsibleCloserId: null,
      jobTitle: "Platform Engineer",
      companyName: "Northstar Labs",
      rawUrl: "https://jobs.example.test/12",
      appliedDate: new Date("2026-09-08T00:00:00.000Z"),
      status: "INTERVIEWING",
      isImportant: false,
      createdAt: new Date("2026-09-08T10:00:00.000Z"),
      updatedAt: new Date("2026-09-08T10:00:00.000Z"),
      version: 1,
    };
    const hydrated = {
      ...lead,
      company: { id: lead.companyId, canonicalName: lead.companyName, createdAt: lead.createdAt, updatedAt: lead.updatedAt, version: 1 },
      profile: { id: lead.profileId, name: "Avery profile", candidate: { id: "80000000-0000-4000-8000-000000000012", firstName: "Avery", lastName: "Chen", preferredName: null } },
      sourceRef: { id: lead.sourceId, name: "LinkedIn" },
      currentOwner: bd,
      responsibleCloser: null,
      contacts: [],
    };
    const database = {
      jobLead: { findUnique: vi.fn().mockResolvedValueOnce(lead).mockResolvedValueOnce(hydrated) },
      interviewRound: { findFirst: vi.fn().mockResolvedValue({ id: "20000000-0000-4000-8000-000000000012" }) },
    };
    const authorization = { assertProfileAccess: vi.fn().mockResolvedValue(undefined) };
    const service = new LeadsService(database as never, authorization as never);

    await expect(service.get(closer, lead.id)).resolves.toMatchObject({ id: lead.id, responsibleCloserId: null });
    expect(database.interviewRound.findFirst).toHaveBeenCalledWith({
      where: { leadId: lead.id, closerId: closer.id },
      select: { id: true },
    });
  });

  it("does not create a duplicate assignment when the Closer is already responsible", async () => {
    const lead = {
      id: "30000000-0000-4000-8000-000000000002",
      profileId: "50000000-0000-4000-8000-000000000002",
      responsibleCloserId: closer.id,
      version: 3,
    };
    const database = {
      jobLead: {
        findUnique: vi.fn().mockResolvedValue(lead),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      profileCloserEligibility: {
        findFirst: vi.fn().mockResolvedValue({ id: "eligibility" }),
      },
      leadCloserAssignment: {
        findFirst: vi.fn().mockResolvedValue({ id: "existing-assignment" }),
        create: vi.fn(),
      },
      activityEvent: { create: vi.fn().mockResolvedValue(undefined) },
    };
    const authorization = { assertProfileAccess: vi.fn().mockResolvedValue(undefined) };
    const service = new LeadsService(database as never, authorization as never);

    await service.assignCloser({ ...closer, role: "ADMIN" }, lead.id, closer.id, 3);

    expect(database.leadCloserAssignment.create).not.toHaveBeenCalled();
    expect(database.activityEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      action: "lead.closer_assigned",
      leadId: lead.id,
      oldSnapshot: { responsibleCloserId: closer.id },
      newSnapshot: { responsibleCloserId: closer.id },
      metadata: { assignmentCreated: false },
    }) });
  });
});
