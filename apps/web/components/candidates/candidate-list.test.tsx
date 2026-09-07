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
  element.value = value;
  element.dispatchEvent(new Event("input", { bubbles: true }));
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
    createCandidateMock.mockResolvedValueOnce(candidate);
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

  it("renders empty and retryable error states", async () => {
    listCandidatesMock
      .mockResolvedValueOnce({ items: [], nextCursor: null })
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ items: [candidate], nextCursor: null });
    await render();
    expect(container.textContent).toContain("No candidates found");

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
