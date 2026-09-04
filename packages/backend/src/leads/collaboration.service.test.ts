import { describe, expect, it, vi } from "vitest";

import { CollaborationService } from "./collaboration.service";

const actor = { id: "10000000-0000-4000-8000-000000000001", displayName: "Maya Brooks", email: "maya@example.test", role: "BD" as const, isActive: true };

describe("CollaborationService activity audit", () => {
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
