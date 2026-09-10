// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Assignment, CalendarConnection, LeadSummary, ProfileSummary, SessionUser, UserSummary } from "@orbit/contracts";
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
  getDashboard: vi.fn(),
  listActivity: vi.fn(),
  listBdAssignments: vi.fn(),
  listCloserEligibility: vi.fn(),
  listDocuments: vi.fn(),
  listLeadInterviewRounds: vi.fn(),
  listLeads: vi.fn(),
  listTasks: vi.fn(),
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
    timezone: "UTC",
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
const lead: LeadSummary = {
  id: "50000000-0000-4000-8000-000000000001",
  profileId: profile.id,
  companyId: "60000000-0000-4000-8000-000000000001",
  sourceId: "70000000-0000-4000-8000-000000000001",
  createdById: bd.id,
  currentOwnerId: bd.id,
  responsibleCloserId: closer.id,
  archivedById: null,
  closedById: null,
  jobTitle: "Staff Platform Engineer",
  companyName: "Example",
  description: null,
  rawUrl: "https://jobs.example.test/staff-platform-engineer",
  canonicalUrl: "https://jobs.example.test/staff-platform-engineer",
  canonicalHash: null,
  location: null,
  workplaceType: null,
  employmentType: null,
  contractType: null,
  compensationMin: null,
  compensationMax: null,
  compensationCurrency: null,
  compensationPeriod: null,
  appliedDate: "2026-09-08",
  status: "INTERVIEWING",
  isImportant: false,
  closureReason: null,
  closureNotes: null,
  closedAt: null,
  placedAt: null,
  startDate: null,
  startedAt: null,
  archivedAt: null,
  archiveReason: null,
  createdAt: "2026-09-08T14:00:00.000Z",
  updatedAt: "2026-09-08T14:00:00.000Z",
  version: 1,
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
    mocks.listLeads.mockResolvedValue({ items: [lead], nextCursor: null });
    mocks.listLeadInterviewRounds.mockResolvedValue([]);
    mocks.listTasks.mockResolvedValue([]);
    mocks.listActivity.mockResolvedValue([]);
    mocks.getDashboard.mockResolvedValue({
      kpis: {
        applications: 1,
        responses: 1,
        interviews: 1,
        interviewRounds: 1,
        attendedRounds: 0,
        cancelledRounds: 0,
        averageRoundsPerInterviewLead: 1,
        roundAttendanceRate: null,
        offers: 0,
        acceptedOffers: 0,
        placements: 0,
        starts: 0,
        activePipeline: 1,
        overdueTasks: 0,
        responseRate: 1,
      },
      breakdowns: { statuses: [{ key: "INTERVIEWING", count: 1 }], sources: [{ key: "LinkedIn", count: 1 }] },
      upcomingInterviews: 1,
    });
    mocks.listUsers.mockResolvedValue([bdUser, closer]);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  async function render(actor: SessionUser, activeTab = "overview") {
    await act(async () => root.render(<ProfileWorkspace actor={actor} profileId={profile.id} calendar={calendar} activeTab={activeTab} />));
  }

  it("lets authorized BDs edit profile data while keeping admin controls hidden", async () => {
    await render(bd);

    expect(container.textContent).toContain("Platform engineering");
    expect(container.textContent).toContain("Ada Lovelace");
    expect(container.textContent).not.toContain("Read-only workspace");
    expect(Array.from(container.querySelectorAll("button")).map((button) => button.textContent)).toContain("Edit profile");
    expect(Array.from(container.querySelectorAll("button")).map((button) => button.textContent)).not.toContain("Manage lifecycle");
    expect(container.textContent).toContain("Candidate profile calendar");
    expect(container.textContent).toContain("Calendar connections are managed by Admins.");
    expect(container.textContent).not.toContain("Assign BD");
    expect(Array.from(container.querySelectorAll('nav[aria-label="Profile sections"] a')).map((link) => link.textContent)).not.toContain("Team");
    expect(mocks.listUsers).not.toHaveBeenCalled();
  });

  it("shows assignment and lifecycle controls only to administrators", async () => {
    await render(admin);

    expect(Array.from(container.querySelectorAll("button")).map((button) => button.textContent)).toContain("Edit profile");
    expect(Array.from(container.querySelectorAll("button")).map((button) => button.textContent)).toContain("Manage lifecycle");
    expect(container.textContent).not.toContain("Upload document");
    expect(container.textContent).not.toContain("Assignment change reason");
  });

  it("opens profile editing in a focused dialog instead of embedding the form", async () => {
    await render(admin);

    expect(container.querySelector('[role="dialog"]')).toBeNull();
    const editButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Edit profile");
    expect(editButton).toBeDefined();
    await act(async () => editButton?.click());
    expect(document.body.querySelector('[role="dialog"]')?.textContent).toContain("Edit profile");
    expect(document.body.querySelector('[role="dialog"]')?.querySelector("form")).not.toBeNull();
  });

  it("keeps profile identity and navigation visible on the leads tab", async () => {
    await render(admin, "leads");

    expect(container.textContent).toContain("Platform engineering");
    expect(container.querySelector('a[aria-current="page"]')?.textContent).toBe("Leads");
    expect(container.querySelector('a[href="/leads/50000000-0000-4000-8000-000000000001"]')?.textContent).toContain("Staff Platform Engineer");
    expect(container.textContent).toContain("Interviewing");
    expect(container.textContent).not.toContain("Employer-linked application");
  });

  it("does not expose profile access management to closers", async () => {
    await render({ ...closer, role: "CLOSER" });

    expect(Array.from(container.querySelectorAll('nav[aria-label="Profile sections"] a')).map((link) => link.textContent)).not.toContain("Team");
  });

  it("returns closers to their accessible assigned applications", async () => {
    await render({ ...closer, role: "CLOSER" });

    expect(container.querySelector('a[href="/leads"]')?.textContent).toBe("← Assigned applications");
    expect(container.querySelector(`a[href="/candidates/${profile.candidateId}"]`)).toBeNull();
  });

  it("renders an unauthorized state for a denied profile request", async () => {
    const ApiError = (await import("../../lib/api-client")).ApiClientError;
    mocks.getProfile.mockRejectedValueOnce(new ApiError("Access denied", "FORBIDDEN", undefined, 403));
    await render(bd);

    expect(container.textContent).toContain("Access restricted");
    expect(container.textContent).not.toContain("Platform engineering");
  });
});
