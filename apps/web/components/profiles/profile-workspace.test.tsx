// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Assignment, CalendarConnection, ProfileSummary, SessionUser, UserSummary } from "@orbit/contracts";
import type { ProfileDetail } from "../../lib/api-client";

import { ProfileWorkspace } from "./profile-workspace";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  activateProfile: vi.fn(),
  archiveProfile: vi.fn(),
  assignBd: vi.fn(),
  endBdAssignment: vi.fn(),
  endCloserEligibility: vi.fn(),
  getProfile: vi.fn(),
  listBdAssignments: vi.fn(),
  listCloserEligibility: vi.fn(),
  listDocuments: vi.fn(),
  listUsers: vi.fn(),
  pauseProfile: vi.fn(),
  restoreProfile: vi.fn(),
  setCloserEligibility: vi.fn(),
  updateProfile: vi.fn(),
}));

vi.mock("../../lib/api-client", () => ({
  ApiClientError: class ApiClientError extends Error {
    constructor(
      message: string,
      public readonly code = "ERROR",
      public readonly requestId?: string,
      public readonly status?: number,
    ) {
      super(message);
    }
  },
  ...mocks,
}));

const admin: SessionUser = {
  id: "10000000-0000-4000-8000-000000000001",
  displayName: "Admin User",
  email: "admin@orbit.test",
  role: "ADMIN",
  isActive: true,
};
const bd: SessionUser = {
  ...admin,
  id: "10000000-0000-4000-8000-000000000002",
  displayName: "BD User",
  email: "bd@orbit.test",
  role: "BD",
};
const profile: ProfileSummary = {
  id: "30000000-0000-4000-8000-000000000001",
  candidateId: "20000000-0000-4000-8000-000000000001",
  name: "Platform engineering",
  description: "Senior platform roles",
  status: "ACTIVE",
  defaultCurrency: "USD",
  targetCompensation: "150000",
  compensationPeriod: "YEARLY",
  targetRoles: ["Staff Engineer"],
  preferredLocations: ["Remote"],
  workplacePreferences: ["Remote"],
  jobTypePreferences: ["Full-time"],
  contractPreferences: [],
  archivedAt: null,
  archiveReason: null,
  createdAt: "2026-09-02T08:00:00.000Z",
  updatedAt: "2026-09-02T08:00:00.000Z",
  version: 1,
};
const detail: ProfileDetail = {
  ...profile,
  candidate: {
    id: profile.candidateId,
    firstName: "Ada",
    lastName: "Lovelace",
    preferredName: null,
  },
};
const calendar: CalendarConnection = {
  connected: false,
  email: null,
  calendarName: null,
  lastSyncedAt: null,
  status: "DISCONNECTED",
};
const bdAssignment: Assignment = {
  id: "40000000-0000-4000-8000-000000000001",
  profileId: profile.id,
  userId: bd.id,
  assignedById: admin.id,
  assignedAt: "2026-09-02T09:00:00.000Z",
  endedAt: null,
  endedReason: null,
};
const closer: UserSummary = {
  id: "10000000-0000-4000-8000-000000000003",
  displayName: "Closer User",
  email: "closer@orbit.test",
  role: "CLOSER",
  isActive: true,
  timezone: "UTC",
  lastLoginAt: null,
};
const bdUser: UserSummary = {
  id: bd.id,
  displayName: bd.displayName,
  email: bd.email,
  role: "BD",
  isActive: true,
  timezone: "UTC",
  lastLoginAt: null,
};

describe("ProfileWorkspace", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.getProfile.mockResolvedValue(detail);
    mocks.listBdAssignments.mockResolvedValue([bdAssignment]);
    mocks.listCloserEligibility.mockResolvedValue([]);
    mocks.listDocuments.mockResolvedValue([]);
    mocks.listUsers.mockResolvedValue([bdUser, closer]);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  async function render(actor: SessionUser) {
    await act(async () => root.render(<ProfileWorkspace actor={actor} profileId={profile.id} calendar={calendar} />));
  }

  it("lets authorized BDs edit profile data while keeping admin controls hidden", async () => {
    await render(bd);

    expect(container.textContent).toContain("Platform engineering");
    expect(container.textContent).toContain("Ada Lovelace");
    expect(container.textContent).toContain("BD User");
    expect(container.textContent).not.toContain("Read-only workspace");
    expect(container.textContent).toContain("Edit profile");
    expect(container.textContent).toContain("Candidate profile calendar");
    expect(container.textContent).toContain("Calendar connections are managed by Admins.");
    expect(container.textContent).not.toContain("Assign BD");
    expect(mocks.listUsers).not.toHaveBeenCalled();
  });

  it("shows assignment and lifecycle controls only to administrators", async () => {
    await render(admin);

    expect(container.textContent).toContain("Edit profile");
    expect(container.textContent).toContain("Assign BD");
    expect(container.textContent).toContain("Add eligible Closer");
    expect(container.textContent).toContain("Pause profile");
    expect(container.textContent).toContain("Archive profile");
    expect(container.textContent).toContain("Closer User");
  });

  it("renders an unauthorized state for a denied profile request", async () => {
    const ApiError = (await import("../../lib/api-client")).ApiClientError;
    mocks.getProfile.mockRejectedValueOnce(new ApiError("Access denied", "FORBIDDEN", undefined, 403));
    await render(bd);

    expect(container.textContent).toContain("Access restricted");
    expect(container.textContent).not.toContain("Platform engineering");
  });
});
