// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LeadPageActions } from "./lead-page-actions";

const { createApplicationIntakeMock, refreshMock } = vi.hoisted(() => ({
  createApplicationIntakeMock: vi.fn(),
  refreshMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: refreshMock }) }));
vi.mock("../../lib/api-client", () => ({
  ApiClientError: class ApiClientError extends Error {
    code = "ERROR";
  },
  createApplicationIntake: createApplicationIntakeMock,
}));
vi.mock("../data/bulk-import-form", () => ({ BulkImportForm: () => null }));

const actor = {
  id: "10000000-0000-4000-8000-000000000001",
  displayName: "Maya Brooks",
  email: "maya@orbit.local",
  role: "BD" as const,
  isActive: true,
};
const profiles = [{
  id: "40000000-0000-4000-8000-000000000001",
  candidateId: "20000000-0000-4000-8000-000000000001",
  name: "Avery Chen — Platform Engineer",
}] as never;

describe("LeadPageActions", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    refreshMock.mockReset();
    createApplicationIntakeMock.mockReset();
    createApplicationIntakeMock.mockResolvedValue({ duplicate: { classification: "NONE" } });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  function enter(label: string, value: string) {
    const input = document.querySelector<HTMLInputElement>(`[aria-label="${label}"]`)
      ?? [...document.querySelectorAll<HTMLInputElement>("input")].find((candidate) => candidate.labels?.[0]?.textContent === label);
    if (!input) throw new Error(`${label} input not found`);
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  it("closes and refreshes after a successful application intake", async () => {
    await act(async () => root.render(<LeadPageActions actor={actor} defaultOpen profiles={profiles} />));
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();

    act(() => {
      enter("Job title", "Platform Engineer");
      enter("Company", "Northstar Labs");
      enter("JD link", "https://jobs.example/platform-engineer");
      enter("Recruiter name", "Jordan Lee");
      enter("Recruiter email", "jordan@example.test");
    });
    const form = document.querySelector<HTMLFormElement>('form[aria-label="Add application"]');
    if (!form) throw new Error("Application form not found");
    await act(async () => form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));

    expect(refreshMock).toHaveBeenCalledOnce();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
});
