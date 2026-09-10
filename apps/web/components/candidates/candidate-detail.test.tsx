// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CandidateSummary, ProfileSummary, SessionUser } from "@orbit/contracts";
import type { CandidateDetail } from "../../lib/api-client";

import { CandidateDetailView } from "./candidate-detail";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  createProfile: vi.fn(),
  getCandidate: vi.fn(),
  updateCandidate: vi.fn(),
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
  email: "bd@orbit.test",
  role: "BD",
};

const candidate: CandidateSummary = {
  id: "20000000-0000-4000-8000-000000000001",
  linkedUserId: null,
  firstName: "Ada",
  lastName: "Lovelace",
  preferredName: "Ada",
  email: "ada@orbit.test",
  phone: "+44 20 7946 0958",
  timezone: "Europe/London",
  location: "London",
  status: "ACTIVE",
  archivedAt: null,
  archiveReason: null,
  createdAt: "2026-09-02T08:00:00.000Z",
  updatedAt: "2026-09-02T08:00:00.000Z",
  version: 1,
};

const profile: ProfileSummary = {
  id: "30000000-0000-4000-8000-000000000001",
  candidateId: candidate.id,
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

const detail: CandidateDetail = { ...candidate, profiles: [profile] };

describe("CandidateDetailView", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.getCandidate.mockResolvedValue(detail);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  async function render(actor: SessionUser = admin) {
    await act(async () => root.render(<CandidateDetailView actor={actor} candidateId={candidate.id} />));
  }

  it("blocks non-admin actors before requesting candidate details", async () => {
    await render(bd);

    expect(container.textContent).toContain("Access restricted");
    expect(mocks.getCandidate).not.toHaveBeenCalled();
  });

  it("shows candidate details and profiles without exposing editing forms inline", async () => {
    await render();

    expect(container.textContent).toContain("Ada Lovelace");
    expect(container.textContent).toContain("ada@orbit.test");
    expect(container.textContent).toContain("Europe/London");
    expect(container.querySelector(`a[href="/profiles/${profile.id}"]`)?.textContent).toContain("Platform engineering");
    expect(container.querySelector('form[aria-label="Edit Ada Lovelace"]')).toBeNull();
    expect(container.querySelector('form[aria-label="Create profile"]')).toBeNull();
  });

  it("opens candidate editing in one focused dialog", async () => {
    await render();

    await act(async () => {
      Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Edit candidate")?.click();
    });

    const dialog = document.body.querySelector('[role="dialog"]');
    expect(dialog?.textContent).toContain("Edit candidate");
    expect(dialog?.querySelector('form[aria-label="Edit Ada Lovelace"]')).not.toBeNull();
    expect(dialog?.querySelectorAll("h2")).toHaveLength(1);
  });

  it("opens profile creation in a separate focused dialog", async () => {
    await render();

    await act(async () => {
      Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Add profile")?.click();
    });

    const dialog = document.body.querySelector('[role="dialog"]');
    expect(dialog?.textContent).toContain("Add profile");
    expect(dialog?.querySelector('form[aria-label="Create profile"]')).not.toBeNull();
    expect(dialog?.querySelectorAll("h2")).toHaveLength(1);
  });
});
