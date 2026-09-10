// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { LeadSummary, ProfileSummary } from "@orbit/contracts";

import { ApplicationPicker } from "./bd-dashboard-quick-actions";

const applications = [{
  id: "00000000-0000-4000-8000-000000000001",
  profileId: "00000000-0000-4000-8000-000000000002",
  companyId: "00000000-0000-4000-8000-000000000003",
  sourceId: "00000000-0000-4000-8000-000000000004",
  createdById: "00000000-0000-4000-8000-000000000005",
  currentOwnerId: "00000000-0000-4000-8000-000000000005",
  responsibleCloserId: null,
  archivedById: null,
  closedById: null,
  jobTitle: "Senior Platform Engineer",
  companyName: "Northstar Labs",
  description: null,
  rawUrl: "https://www.linkedin.com/jobs/view/123",
  canonicalUrl: null,
  canonicalHash: null,
  location: null,
  workplaceType: null,
  employmentType: null,
  contractType: null,
  compensationMin: null,
  compensationMax: null,
  compensationCurrency: null,
  compensationPeriod: null,
  appliedDate: "2026-09-10",
  status: "RESPONSE_RECEIVED",
  isImportant: false,
  closureReason: null,
  closureNotes: null,
  closedAt: null,
  placedAt: null,
  startDate: null,
  startedAt: null,
  archivedAt: null,
  archiveReason: null,
  createdAt: "2026-09-10T08:00:00.000Z",
  updatedAt: "2026-09-10T08:00:00.000Z",
  version: 1,
}] as LeadSummary[];

const profiles = [{
  id: applications[0].profileId,
  candidateId: "00000000-0000-0000-0000-000000000010",
  name: "Eyong profile",
}] as ProfileSummary[];

describe("ApplicationPicker", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("filters applications by job, company, profile, and platform", () => {
    act(() => root.render(<ApplicationPicker applications={applications} profiles={profiles} onSelect={() => undefined} />));

    const search = container.querySelector<HTMLInputElement>('input[aria-label="Search applications"]');
    expect(container.textContent).toContain("Senior Platform Engineer");

    act(() => {
      if (search) {
        search.value = "linkedin";
        search.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });

    expect(container.textContent).toContain("Northstar Labs");
  });

  it("reports the selected application from a compact result row", () => {
    let selected = "";
    act(() => root.render(<ApplicationPicker applications={applications} profiles={profiles} onSelect={(id) => { selected = id; }} />));

    act(() => container.querySelector<HTMLButtonElement>('button[data-application-id]')?.click());
    expect(selected).toBe(applications[0].id);
  });

  it("filters by company and stage from the compact filter menu", () => {
    act(() => root.render(<ApplicationPicker applications={applications} profiles={profiles} onSelect={() => undefined} />));

    act(() => container.querySelector<HTMLButtonElement>('button[aria-label="Filter applications"]')?.click());
    const companyFilter = container.querySelector<HTMLSelectElement>('select[aria-label="Filter applications by company"]');
    const stageFilter = container.querySelector<HTMLSelectElement>('select[aria-label="Filter applications by stage"]');

    expect(companyFilter).not.toBeNull();
    expect(stageFilter).not.toBeNull();
    act(() => {
      if (companyFilter) {
        companyFilter.value = "Northstar Labs";
        companyFilter.dispatchEvent(new Event("change", { bubbles: true }));
      }
      if (stageFilter) {
        stageFilter.value = "RESPONSE_RECEIVED";
        stageFilter.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });

    expect(container.textContent).toContain("1 match");
  });
});
