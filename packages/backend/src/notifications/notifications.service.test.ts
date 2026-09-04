import { describe, expect, it, vi } from "vitest";

import { NotificationsService } from "./notifications.service";

const closer = {
  id: "10000000-0000-4000-8000-000000000001",
  displayName: "Closer User",
  email: "closer@orbit.test",
  role: "CLOSER" as const,
  isActive: true,
};

const visibleLeadId = "20000000-0000-4000-8000-000000000001";

function activity(id: string, leadId: string, occurredAt: string) {
  return {
    id,
    actorId: closer.id,
    actorNameSnapshot: "Closer User",
    actorRoleSnapshot: "CLOSER",
    entityType: "INTERVIEW",
    entityId: id,
    action: "INTERVIEW_SCHEDULED",
    profileId: null,
    leadId,
    metadata: null,
    occurredAt: new Date(occurredAt),
  };
}

describe("NotificationsService.activity", () => {
  it("filters to closer-visible activity before applying the requested limit", async () => {
    const hiddenEvents = Array.from({ length: 10 }, (_, index) => activity(
      `30000000-0000-4000-8000-0000000000${String(index).padStart(2, "0")}`,
      `40000000-0000-4000-8000-0000000000${String(index).padStart(2, "0")}`,
      `2026-09-03T${String(10 + index).padStart(2, "0")}:00:00.000Z`,
    ));
    const visibleEvent = activity("30000000-0000-4000-8000-000000000099", visibleLeadId, "2026-09-02T10:00:00.000Z");
    const activityEvent = {
      findMany: vi.fn(async ({ where, take }: { where: { OR?: Array<{ leadId?: { in: string[] } }> }; take: number }) => {
        const leadIds = where.OR?.flatMap((condition) => condition.leadId?.in ?? []) ?? [];
        return [...hiddenEvents, visibleEvent]
          .filter((event) => leadIds.length === 0 || leadIds.includes(event.leadId))
          .slice(0, take);
      }),
    };
    const database = {
      activityEvent,
      jobLead: { findMany: vi.fn().mockResolvedValue([{ id: visibleLeadId }]) },
      profileCloserEligibility: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const service = new NotificationsService(database as never);

    await expect(service.activity(closer, { limit: 1 })).resolves.toMatchObject([
      { id: visibleEvent.id, leadId: visibleLeadId },
    ]);
    expect(activityEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ OR: [{ leadId: { in: [visibleLeadId] } }] }),
      take: 1,
    }));
  });
});
