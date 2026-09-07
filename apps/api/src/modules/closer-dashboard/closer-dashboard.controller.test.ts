import "reflect-metadata";

import type { CloserDashboardService, SessionRequest } from "@orbit/backend";
import { AuthenticationError } from "@orbit/backend";
import { describe, expect, it, vi } from "vitest";

import { CloserDashboardController } from "./closer-dashboard.controller";
import type { AuthenticatedRequest } from "../identity/identity.guard";

const closer = {
  id: "10000000-0000-4000-8000-000000000001",
  displayName: "Closer User",
  email: "closer@orbit.test",
  role: "CLOSER" as const,
  isActive: true,
};

function dashboard() {
  return {
    timezone: "UTC",
    assignedApplications: [],
    nextMeeting: null,
    todayMeetings: [],
    externalMeetings: [],
    needsFeedback: [],
    openTasks: [],
    conflicts: [],
    notifications: [],
    recentActivity: [],
    lifetimeFunnel: {
      applicationsHandled: 0,
      interviewsScheduled: 0,
      callsAttended: 0,
      offers: 0,
      placements: 0,
    },
    calendarConnection: {
      connected: false,
      email: null,
      calendarName: null,
      lastSyncedAt: null,
      status: "DISCONNECTED",
    },
  };
}

function requestFor(actor = closer): AuthenticatedRequest {
  return { actor, cookies: {} };
}

function createHarness(result: unknown = dashboard()) {
  const service = { get: vi.fn().mockResolvedValue(result) };

  return {
    controller: new CloserDashboardController(service as unknown as CloserDashboardService),
    service,
  };
}

describe("CloserDashboardController", () => {
  it("rejects a request without an authenticated actor before it reaches the service", async () => {
    const { controller, service } = createHarness();
    const request: SessionRequest = { cookies: {} };

    await expect(
      Promise.resolve().then(() => controller.get(request)),
    ).rejects.toEqual(new AuthenticationError());
    expect(service.get).not.toHaveBeenCalled();
  });

  it("rejects malformed closer dashboard data before response serialization", async () => {
    const invalidDashboard = dashboard();
    delete (invalidDashboard.calendarConnection as { status?: string }).status;
    const { controller } = createHarness(invalidDashboard);

    await expect(controller.get(requestFor())).rejects.toMatchObject({ name: "ZodError" });
  });
});
