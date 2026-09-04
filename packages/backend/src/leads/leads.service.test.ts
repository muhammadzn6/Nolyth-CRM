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

describe("LeadsService authorization", () => {
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
    };
    const authorization = {
      assertProfileAccess: vi.fn().mockResolvedValue(undefined),
    };
    const service = new LeadsService(database as never, authorization as never);

    await expect(service.get(closer, lead.id)).rejects.toEqual(new AuthorizationError());
    expect(authorization.assertProfileAccess).toHaveBeenCalledWith(closer, lead.profileId);
    expect(database.jobLead.findUnique).toHaveBeenCalledTimes(1);
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
