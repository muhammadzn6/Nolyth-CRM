// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LeadSummary, UserSummary } from "@orbit/contracts";

const { assignLeadCloserMock, refreshMock } = vi.hoisted(() => ({
  assignLeadCloserMock: vi.fn(),
  refreshMock: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: refreshMock }) }));
vi.mock("../../lib/api-client", () => ({ assignLeadCloser: assignLeadCloserMock }));

import { LeadCloserAssignment } from "./lead-closer-assignment";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const closer = { id: "10000000-0000-4000-8000-000000000002", displayName: "Noah Patel", email: "noah@orbit.local", role: "CLOSER", isActive: true } as unknown as UserSummary;
const lead = { id: "30000000-0000-4000-8000-000000000001", responsibleCloserId: closer.id, version: 2 } as unknown as LeadSummary;

describe("LeadCloserAssignment", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    assignLeadCloserMock.mockReset();
    refreshMock.mockReset();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    document.body.replaceChildren();
  });

  it("keeps ownership editing in a modal and disables an unchanged assignment", async () => {
    await act(async () => root.render(<LeadCloserAssignment closers={[closer]} lead={lead} />));
    expect(document.querySelector('[role="dialog"]')).toBeNull();

    const trigger = [...document.querySelectorAll("button")].find((button) => button.textContent?.includes("Change closer"));
    if (!trigger) throw new Error("Change closer trigger not found");
    await act(async () => trigger.click());

    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    const save = [...document.querySelectorAll("button")].find((button) => button.textContent?.includes("Save closer"));
    expect(save?.disabled).toBe(true);
    expect(assignLeadCloserMock).not.toHaveBeenCalled();
  });

  it("uses assignment language when the application has no responsible closer", async () => {
    await act(async () => root.render(<LeadCloserAssignment closers={[closer]} lead={{ ...lead, responsibleCloserId: null }} />));

    const trigger = [...document.querySelectorAll("button")].find((button) => button.textContent?.includes("Assign closer"));
    expect(trigger).toBeTruthy();
    await act(async () => trigger?.click());

    expect(document.querySelector('[role="dialog"]')?.textContent).toContain("Assign responsible Closer");
  });

  it("closes and refreshes after a successful assignment", async () => {
    assignLeadCloserMock.mockResolvedValue({ ...lead, responsibleCloserId: closer.id, version: 3 });
    await act(async () => root.render(<LeadCloserAssignment closers={[closer]} lead={{ ...lead, responsibleCloserId: null }} />));

    const trigger = [...document.querySelectorAll("button")].find((button) => button.textContent?.includes("Assign closer"));
    if (!trigger) throw new Error("Assign closer trigger not found");
    await act(async () => trigger.click());

    const select = document.querySelector<HTMLSelectElement>("#lead-closer");
    if (!select) throw new Error("Closer select not found");
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set?.call(select, closer.id);
    await act(async () => select.dispatchEvent(new Event("change", { bubbles: true })));

    const save = [...document.querySelectorAll("button")].find((button) => button.textContent?.includes("Save closer"));
    if (!save) throw new Error("Save closer button not found");
    await act(async () => save.click());

    expect(assignLeadCloserMock).toHaveBeenCalledWith(lead.id, closer.id, lead.version);
    expect(refreshMock).toHaveBeenCalledOnce();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
});
