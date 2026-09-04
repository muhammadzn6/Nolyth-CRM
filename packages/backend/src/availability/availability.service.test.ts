import { describe, expect, it, vi } from "vitest";

import { AvailabilityService } from "./availability.service";

const actor = { id: "10000000-0000-4000-8000-000000000002", displayName: "Noah Patel", email: "noah@example.test", role: "CLOSER" as const, isActive: true };

describe("AvailabilityService activity audit", () => {
  it("audits a new availability exception", async () => {
    const row = { id: "20000000-0000-4000-8000-000000000001", closerId: actor.id, startsAt: new Date("2026-09-05T09:00:00Z"), endsAt: new Date("2026-09-05T10:00:00Z"), type: "UNAVAILABLE", reason: "Personal appointment" };
    const database = { availabilityException: { create: vi.fn().mockResolvedValue(row) }, activityEvent: { create: vi.fn().mockResolvedValue(undefined) } };
    const service = new AvailabilityService(database as never, {} as never);

    await service.addException(actor, { startsAt: row.startsAt.toISOString(), endsAt: row.endsAt.toISOString(), type: "UNAVAILABLE", reason: row.reason });

    expect(database.activityEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: "availability.exception_created", entityType: "availability_exception", entityId: row.id, profileId: null, leadId: null }) });
  });
});
