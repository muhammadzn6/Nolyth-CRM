import { describe, expect, it, vi } from "vitest";

import { CollaborationService } from "./collaboration.service";

const actor = { id: "10000000-0000-4000-8000-000000000001", displayName: "Maya Brooks", email: "maya@example.test", role: "BD" as const, isActive: true };

describe("CollaborationService activity audit", () => {
  it("keeps internal communications hidden from an assigned closer", async () => {
    const closer = { id: "10000000-0000-4000-8000-000000000009", displayName: "Noah Patel", email: "noah@example.test", role: "CLOSER" as const, isActive: true };
    const lead = { id: "30000000-0000-4000-8000-000000000009", profileId: "40000000-0000-4000-8000-000000000009", currentOwnerId: actor.id, responsibleCloserId: closer.id };
    const baseCommunication = { leadId: lead.id, authorId: actor.id, contactId: null, type: "NOTE", direction: "INTERNAL", subject: null, occurredAt: new Date(), outcome: null, nextActionSummary: null, nextActionDueAt: null, archivedAt: null, version: 1, createdAt: new Date(), updatedAt: new Date() };
    const database = {
      jobLead: { findUnique: vi.fn().mockResolvedValue(lead) },
      communication: { findMany: vi.fn().mockResolvedValue([
        { ...baseCommunication, id: "20000000-0000-4000-8000-000000000010", body: "Internal handoff", visibility: "INTERNAL_TEAM" },
        { ...baseCommunication, id: "20000000-0000-4000-8000-000000000011", body: "Closer briefing", visibility: "SHARED_WITH_CLOSER" },
      ]) },
    };
    const service = new CollaborationService(database as never, { assertProfileAccess: vi.fn().mockResolvedValue(undefined) } as never);

    await expect(service.listCommunications(closer, lead.id, { archived: false, limit: 50 })).resolves.toMatchObject([
      { id: "20000000-0000-4000-8000-000000000011" },
    ]);
  });

  it("lets an assigned interview closer read shared comments without making them the responsible closer", async () => {
    const closer = { id: "10000000-0000-4000-8000-000000000009", displayName: "Noah Patel", email: "noah@example.test", role: "CLOSER" as const, isActive: true };
    const lead = { id: "30000000-0000-4000-8000-000000000009", profileId: "40000000-0000-4000-8000-000000000009", currentOwnerId: actor.id, responsibleCloserId: null };
    const sharedComment = { id: "20000000-0000-4000-8000-000000000009", leadId: lead.id, authorId: actor.id, body: "Review the system design notes.", visibility: "SHARED_WITH_CLOSER", archivedAt: null, createdAt: new Date(), updatedAt: new Date(), version: 1 };
    const database = {
      jobLead: { findUnique: vi.fn().mockResolvedValue(lead) },
      interviewRound: { findFirst: vi.fn().mockResolvedValue({ id: "50000000-0000-4000-8000-000000000009" }) },
      comment: { findMany: vi.fn().mockResolvedValue([sharedComment]) },
    };
    const service = new CollaborationService(database as never, { assertProfileAccess: vi.fn().mockResolvedValue(undefined) } as never);

    await expect(service.listComments(closer, lead.id)).resolves.toMatchObject([{ id: sharedComment.id }]);
    expect(database.interviewRound.findFirst).toHaveBeenCalledWith({
      where: { leadId: lead.id, closerId: closer.id },
      select: { id: true },
    });
  });

  it("prevents a closer from changing their shared comment to internal visibility", async () => {
    const closer = { id: "10000000-0000-4000-8000-000000000009", displayName: "Noah Patel", email: "noah@example.test", role: "CLOSER" as const, isActive: true };
    const lead = { id: "30000000-0000-4000-8000-000000000009", profileId: "40000000-0000-4000-8000-000000000009", currentOwnerId: actor.id, responsibleCloserId: closer.id };
    const sharedComment = { id: "20000000-0000-4000-8000-000000000009", leadId: lead.id, authorId: closer.id, body: "Review the system design notes.", visibility: "SHARED_WITH_CLOSER", archivedAt: null, createdAt: new Date(), updatedAt: new Date(), version: 1 };
    const database = {
      jobLead: { findUnique: vi.fn().mockResolvedValue(lead) },
      comment: { findUnique: vi.fn().mockResolvedValue(sharedComment), updateMany: vi.fn() },
    };
    const service = new CollaborationService(database as never, { assertProfileAccess: vi.fn().mockResolvedValue(undefined) } as never);

    await expect(service.updateComment(closer, sharedComment.id, { expectedVersion: 1, visibility: "INTERNAL_TEAM" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(database.comment.updateMany).not.toHaveBeenCalled();
  });

  it("advances an applied lead when an inbound recruiter response is recorded", async () => {
    const leadId = "30000000-0000-4000-8000-000000000004";
    const lead = { id: leadId, profileId: "40000000-0000-4000-8000-000000000001", companyId: "60000000-0000-4000-8000-000000000001", currentOwnerId: actor.id, status: "APPLIED" };
    const created = { id: "20000000-0000-4000-8000-000000000004", leadId, authorId: actor.id, contactId: null, type: "EMAIL", direction: "INBOUND", subject: "Interview availability", body: "Can we schedule a screening?", occurredAt: new Date("2026-09-08T09:00:00.000Z"), outcome: null, visibility: "INTERNAL_TEAM", nextActionSummary: null, nextActionDueAt: null, archivedAt: null, version: 1, createdAt: new Date(), updatedAt: new Date() };
    const database: any = {
      $transaction: async (work: any) => work(database),
      jobLead: { findUnique: vi.fn().mockResolvedValue(lead), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      leadStatusTransition: { create: vi.fn().mockResolvedValue(undefined) },
      communication: { create: vi.fn().mockResolvedValue(created) },
      activityEvent: { create: vi.fn().mockResolvedValue(undefined) },
    };
    const service = new CollaborationService(database as never, { assertProfileAccess: vi.fn().mockResolvedValue(undefined) } as never);

    await service.createCommunication(actor, leadId, { type: "EMAIL", direction: "INBOUND", subject: "Interview availability", body: "Can we schedule a screening?", occurredAt: "2026-09-08T09:00:00.000Z", visibility: "INTERNAL_TEAM" });

    expect(database.jobLead.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: leadId, status: "APPLIED" }), data: expect.objectContaining({ status: "RESPONSE_RECEIVED" }) }));
    expect(database.leadStatusTransition.create).toHaveBeenCalledWith({ data: expect.objectContaining({ leadId, fromStatus: "APPLIED", toStatus: "RESPONSE_RECEIVED" }) });
    expect(database.activityEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: "lead.status_advanced", metadata: { source: "domain_mutation", trigger: "communication.inbound" } }) });
  });

  it("completes an eligible open follow-up in the same transaction as an outbound recruiter communication", async () => {
    const leadId = "30000000-0000-4000-8000-000000000001";
    const communication = { id: "20000000-0000-4000-8000-000000000002", leadId, authorId: actor.id, contactId: "50000000-0000-4000-8000-000000000001", type: "EMAIL", direction: "OUTBOUND", subject: null, body: "Thanks", occurredAt: new Date("2026-09-08T09:00:00.000Z"), outcome: null, visibility: "INTERNAL_TEAM", nextActionSummary: null, nextActionDueAt: null, archivedAt: null, version: 1, createdAt: new Date(), updatedAt: new Date() };
    const database: any = {
      $transaction: async (work: any) => work(database),
      jobLead: { findUnique: vi.fn().mockResolvedValue({ id: leadId, profileId: "40000000-0000-4000-8000-000000000001", companyId: "60000000-0000-4000-8000-000000000001", currentOwnerId: actor.id }) },
      contact: { findFirst: vi.fn().mockResolvedValue({ id: communication.contactId }) },
      communication: { create: vi.fn().mockResolvedValue(communication) }, activityEvent: { create: vi.fn().mockResolvedValue(undefined) },
    };
    const performance = { completeFollowUpFromCommunication: vi.fn().mockResolvedValue(undefined) };
    const service = new CollaborationService(database as never, { assertProfileAccess: vi.fn().mockResolvedValue(undefined) } as never, performance);

    await service.createCommunication(actor, leadId, { contactId: communication.contactId, type: "EMAIL", direction: "OUTBOUND", body: "Thanks", occurredAt: "2026-09-08T09:00:00.000Z", visibility: "INTERNAL_TEAM" });

    expect(performance.completeFollowUpFromCommunication).toHaveBeenCalledWith(actor, leadId, communication.id, communication.occurredAt, database);
  });

  it("completes an eligible open follow-up for outbound recruiter work even without a selected contact", async () => {
    const leadId = "30000000-0000-4000-8000-000000000003";
    const communication = { id: "20000000-0000-4000-8000-000000000003", leadId, authorId: actor.id, contactId: null, type: "LINKEDIN", direction: "OUTBOUND", subject: null, body: "Confirmed availability", occurredAt: new Date("2026-09-08T09:00:00.000Z"), outcome: null, visibility: "INTERNAL_TEAM", nextActionSummary: null, nextActionDueAt: null, archivedAt: null, version: 1, createdAt: new Date(), updatedAt: new Date() };
    const database: any = {
      $transaction: async (work: any) => work(database),
      jobLead: { findUnique: vi.fn().mockResolvedValue({ id: leadId, profileId: "40000000-0000-4000-8000-000000000001", companyId: "60000000-0000-4000-8000-000000000001", currentOwnerId: actor.id }) },
      communication: { create: vi.fn().mockResolvedValue(communication) }, activityEvent: { create: vi.fn().mockResolvedValue(undefined) },
    };
    const performance = { completeFollowUpFromCommunication: vi.fn().mockResolvedValue(undefined) };
    const service = new CollaborationService(database as never, { assertProfileAccess: vi.fn().mockResolvedValue(undefined) } as never, performance);

    await service.createCommunication(actor, leadId, { type: "LINKEDIN", direction: "OUTBOUND", body: "Confirmed availability", occurredAt: "2026-09-08T09:00:00.000Z", visibility: "INTERNAL_TEAM" });

    expect(performance.completeFollowUpFromCommunication).toHaveBeenCalledWith(actor, leadId, communication.id, communication.occurredAt, database);
  });

  it("audits a new comment against its application", async () => {
    const comment = {
      id: "20000000-0000-4000-8000-000000000001",
      leadId: "30000000-0000-4000-8000-000000000001",
      authorId: actor.id,
      body: "Recruiter confirmed the next round.",
      visibility: "SHARED_WITH_CLOSER",
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      archivedAt: null,
    };
    const database = {
      jobLead: { findUnique: vi.fn().mockResolvedValue({ id: comment.leadId, profileId: "40000000-0000-4000-8000-000000000001", currentOwnerId: actor.id }) },
      comment: { create: vi.fn().mockResolvedValue(comment) },
      activityEvent: { create: vi.fn().mockResolvedValue(undefined) },
    };
    const authorization = { assertProfileAccess: vi.fn().mockResolvedValue(undefined) };
    const service = new CollaborationService(database as never, authorization as never);

    await service.createComment(actor, comment.leadId, { body: comment.body, visibility: "SHARED_WITH_CLOSER" });

    expect(database.activityEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      action: "comment.created",
      entityType: "comment",
      entityId: comment.id,
      leadId: comment.leadId,
      profileId: "40000000-0000-4000-8000-000000000001",
    }) });
  });
});
