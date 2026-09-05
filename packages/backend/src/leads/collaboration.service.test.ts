import { describe, expect, it, vi } from "vitest";

import { CollaborationService } from "./collaboration.service";

const actor = { id: "10000000-0000-4000-8000-000000000001", displayName: "Maya Brooks", email: "maya@example.test", role: "BD" as const, isActive: true };

describe("CollaborationService activity audit", () => {
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
