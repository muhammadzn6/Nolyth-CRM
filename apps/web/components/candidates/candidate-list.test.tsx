// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CandidateSummary, SessionUser } from "@orbit/contracts";

import { CandidateList } from "./candidate-list";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { createCandidateMock, listCandidatesMock } = vi.hoisted(() => ({
  createCandidateMock: vi.fn(),
  listCandidatesMock: vi.fn(),
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
  createCandidate: createCandidateMock,
  listCandidates: listCandidatesMock,
}));

const admin: SessionUser = {
  id: "10000000-0000-4000-8000-000000000001",
  displayName: "Admin User",
  email: "admin@orbit.test",
  role: "ADMIN",
  isActive: true,
};
const bd: SessionUser = { ...admin, role: "BD", id: "10000000-0000-4000-8000-000000000002" };
const candidate: CandidateSummary = {
  id: "20000000-0000-4000-8000-000000000001",
  linkedUserId: null,
  firstName: "Ada",
  lastName: "Lovelace",
  preferredName: null,
  email: "ada@orbit.test",
  phone: null,
  timezone: "Europe/London",
  location: "London",
  status: "ACTIVE",
  archivedAt: null,
  archiveReason: null,
  createdAt: "2026-09-02T08:00:00.000Z",
  updatedAt: "2026-09-02T08:00:00.000Z",
  version: 1,
};

function change(element: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

function select(element: HTMLSelectElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set?.call(element, value);
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("CandidateList", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    createCandidateMock.mockReset();
    listCandidatesMock.mockReset();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  async function render(actor: SessionUser = admin) {
    await act(async () => root.render(<CandidateList actor={actor} />));
  }

  it("blocks non-admin actors before requesting candidate data", async () => {
    await render(bd);

    expect(container.textContent).toContain("Access restricted");
    expect(listCandidatesMock).not.toHaveBeenCalled();
  });

  it("shows searchable candidate links and creates a candidate", async () => {
    listCandidatesMock.mockResolvedValueOnce({ items: [candidate], nextCursor: null });
    createCandidateMock.mockResolvedValueOnce({
      ...candidate,
      id: "20000000-0000-4000-8000-000000000002",
      email: "new-candidate@orbit.test",
    });
    await render();

    expect(container.querySelector(`a[href="/candidates/${candidate.id}"]`)?.textContent).toContain(
      "Ada Lovelace",
    );
    expect(container.querySelector('form[aria-label="Create candidate"]')).toBeNull();
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[aria-label="Add candidate"]')?.click();
    });
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain("Add candidate");
    change(document.querySelector<HTMLInputElement>("#candidate-firstName")!, "Ada");
    change(document.querySelector<HTMLInputElement>("#candidate-lastName")!, "Lovelace");
    change(document.querySelector<HTMLInputElement>("#candidate-email")!, "ADA@ORBIT.TEST");
    change(document.querySelector<HTMLInputElement>("#candidate-timezone")!, "Europe/London");

    await act(async () => {
      document.querySelector<HTMLFormElement>('form[aria-label="Create candidate"]')?.requestSubmit();
    });

    expect(createCandidateMock).toHaveBeenCalledWith({
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ADA@ORBIT.TEST",
      timezone: "Europe/London",
    });
    expect(container.textContent).toContain("Candidate created");
  });

  it("filters candidates by search and status and can clear both filters", async () => {
    listCandidatesMock.mockResolvedValue({ items: [candidate], nextCursor: null });
    await render();

    await act(async () => {
      change(container.querySelector<HTMLInputElement>("#candidate-search")!, "  Ada  ");
      select(container.querySelector<HTMLSelectElement>("#candidate-status")!, "ARCHIVED");
    });
    await act(async () => {
      container.querySelector<HTMLFormElement>('form[aria-label="Filter candidates"]')?.requestSubmit();
    });

    expect(listCandidatesMock).toHaveBeenLastCalledWith({
      search: "Ada",
      status: "ARCHIVED",
      limit: 50,
    });
    expect(container.textContent).toContain("Clear");

    await act(async () => {
      Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
        .find((button) => button.textContent === "Clear")
        ?.click();
    });

    expect(listCandidatesMock).toHaveBeenLastCalledWith({ limit: 50 });
    expect(container.querySelector<HTMLInputElement>("#candidate-search")?.value).toBe("");
    expect(container.querySelector<HTMLSelectElement>("#candidate-status")?.value).toBe("");
  });

  it("renders candidate records as responsive structured rows", async () => {
    listCandidatesMock.mockResolvedValueOnce({ items: [candidate], nextCursor: null });
    await render();

    const records = container.querySelector('[aria-label="Candidate records"]');
    expect(records?.querySelector("table")).toBeNull();
    expect(records?.querySelectorAll("article")).toHaveLength(1);
    expect(records?.textContent).toContain("Location");
    expect(records?.textContent).toContain("Timezone");
    expect(records?.textContent).toContain("Status");
  });

  it("shows a filter-aware empty state without treating it as an empty directory", async () => {
    listCandidatesMock
      .mockResolvedValueOnce({ items: [candidate], nextCursor: null })
      .mockResolvedValueOnce({ items: [], nextCursor: null })
      .mockResolvedValueOnce({ items: [], nextCursor: null });
    await render();

    await act(async () => {
      change(container.querySelector<HTMLInputElement>("#candidate-search")!, "Missing");
    });
    await act(async () => {
      container.querySelector<HTMLFormElement>('form[aria-label="Filter candidates"]')?.requestSubmit();
    });

    expect(container.textContent).toContain("No candidates match these filters");
    expect(container.textContent).not.toContain("Use Add candidate");

    await act(async () => {
      change(container.querySelector<HTMLInputElement>("#candidate-search")!, "");
    });
    expect(container.textContent).toContain("No candidates match these filters");

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[aria-label="Refresh candidates"]')?.click();
    });
    expect(listCandidatesMock).toHaveBeenLastCalledWith({ search: "Missing", limit: 50 });
  });

  it("renders empty and retryable error states", async () => {
    listCandidatesMock
      .mockResolvedValueOnce({ items: [], nextCursor: null })
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ items: [candidate], nextCursor: null });
    await render();
    expect(container.textContent).toContain("No candidates yet");

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[aria-label="Refresh candidates"]')?.click();
    });
    expect(container.textContent).toContain("Candidates unavailable");

    await act(async () => {
      Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
        .find((button) => button.textContent === "Retry")
        ?.click();
    });
    expect(container.textContent).toContain("Ada Lovelace");
  });
});
