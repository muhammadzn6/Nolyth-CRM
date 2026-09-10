import { describe, expect, it, vi } from "vitest";

import { advanceLeadStatus } from "./lead-status";

const actor = {
  id: "10000000-0000-4000-8000-000000000001",
  displayName: "Maya Brooks",
  email: "maya@example.test",
  role: "BD" as const,
  isActive: true,
};

function database(count = 1) {
  return {
    jobLead: { updateMany: vi.fn().mockResolvedValue({ count }) },
    leadStatusTransition: { create: vi.fn().mockResolvedValue(undefined) },
    activityEvent: { create: vi.fn().mockResolvedValue(undefined) },
  };
}

describe("advanceLeadStatus", () => {
  it.each(["OFFER_ACCEPTED", "PLACED", "STARTED", "CLOSED"])(
    "does not move a %s lead backward",
    async (status) => {
      const store = database();

      const changed = await advanceLeadStatus(
        store,
        actor,
        { id: "lead-1", profileId: "profile-1", status },
        "INTERVIEWING",
      );

      expect(changed).toBe(false);
      expect(store.jobLead.updateMany).not.toHaveBeenCalled();
      expect(store.leadStatusTransition.create).not.toHaveBeenCalled();
      expect(store.activityEvent.create).not.toHaveBeenCalled();
    },
  );

  it("writes placement metadata with the guarded status update", async () => {
    const store = database();
    const startDate = new Date("2026-10-01T00:00:00.000Z");

    await advanceLeadStatus(
      store,
      actor,
      { id: "lead-1", profileId: "profile-1", status: "OFFER_ACCEPTED" },
      "PLACED",
      { startDate },
    );

    expect(store.jobLead.updateMany).toHaveBeenCalledWith({
      where: { id: "lead-1", status: "OFFER_ACCEPTED" },
      data: { startDate, status: "PLACED", version: { increment: 1 } },
    });
    expect(store.leadStatusTransition.create).toHaveBeenCalledOnce();
    expect(store.activityEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      action: "lead.status_advanced",
      oldSnapshot: { status: "OFFER_ACCEPTED" },
      newSnapshot: { fromStatus: "OFFER_ACCEPTED", toStatus: "PLACED" },
      metadata: { source: "domain_mutation", trigger: "domain_mutation" },
    }) });
  });

  it("records the domain mutation trigger for an automatic advancement", async () => {
    const store = database();

    await advanceLeadStatus(store, actor, { id: "lead-1", profileId: "profile-1", status: "APPLIED" }, "INTERVIEWING", {}, "interview.created");

    expect(store.activityEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      action: "lead.status_advanced",
      metadata: { source: "domain_mutation", trigger: "interview.created" },
    }) });
  });
});
