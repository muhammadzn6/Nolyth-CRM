import { describe, expect, it, vi } from "vitest";

import { OffersService } from "./offers.service";

const actor = { id: "10000000-0000-4000-8000-000000000001", displayName: "Maya Brooks", email: "maya@example.test", role: "BD" as const, isActive: true };

describe("OffersService activity audit", () => {
  it("audits offer creation against its application", async () => {
    const lead = { id: "30000000-0000-4000-8000-000000000001", profileId: "40000000-0000-4000-8000-000000000001", currentOwnerId: actor.id, status: "INTERVIEWING" };
    const row = { id: "50000000-0000-4000-8000-000000000001", leadId: lead.id, status: "OFFERED", compensationAmount: 150000, compensationCurrency: "USD", employmentType: "FULL_TIME", details: "Base and equity", decisionDeadline: null, acceptedAt: null, startDate: null, startedAt: null, createdById: actor.id, version: 1, createdAt: new Date(), updatedAt: new Date() };
    const database = {
      jobLead: { findUnique: vi.fn().mockResolvedValue(lead), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      offer: { create: vi.fn().mockResolvedValue(row) },
      activityEvent: { create: vi.fn().mockResolvedValue(undefined) },
    };
    const authorization = { assertProfileAccess: vi.fn().mockResolvedValue(undefined) };
    const service = new OffersService(database as never, authorization as never);

    await service.create(actor, lead.id, { compensationAmount: "150000", compensationCurrency: "USD", employmentType: "FULL_TIME", details: "Base and equity" });

    expect(database.activityEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: "offer.created", entityType: "offer", entityId: row.id, leadId: lead.id, profileId: lead.profileId }) });
  });
});
