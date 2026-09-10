// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { LeadActionCenter } from "./lead-action-center";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined }) }));

describe("LeadActionCenter", () => {
  let root: Root | undefined;
  let container: HTMLDivElement | undefined;

  afterEach(() => {
    if (root) act(() => root?.unmount());
    container?.remove();
  });

  it("offers application-scoped communication and interview actions without tab navigation", () => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    act(() => root?.render(<LeadActionCenter actorRole="BD" closers={[]} contacts={[]} leadId="30000000-0000-4000-8000-000000000001" timezone="America/New_York" />));

    const trigger = container.querySelector<HTMLButtonElement>('button[aria-label="Application actions"]');
    expect(trigger).not.toBeNull();
    act(() => trigger?.click());

    expect(container.textContent).toContain("Log communication");
    expect(container.textContent).toContain("Log recruiter response");
    expect(container.textContent).toContain("Add comment");
    expect(container.textContent).toContain("Schedule interview");
    expect(container.querySelector('[role="menu"][aria-label="Application actions"]')).not.toBeNull();
  });

  it("closes the action menu when an action opens its modal", async () => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    act(() => root?.render(<LeadActionCenter actorRole="BD" closers={[]} contacts={[]} leadId="30000000-0000-4000-8000-000000000001" timezone="America/New_York" />));

    await act(async () => { container?.querySelector<HTMLButtonElement>('button[aria-label="Application actions"]')?.click(); });
    await act(async () => { Array.from(container?.querySelectorAll("button") ?? []).find((button) => button.textContent === "Log communication")?.click(); });
    await act(async () => { await Promise.resolve(); });

    expect(container.querySelector('[role="menu"][aria-label="Application actions"]')).toBeNull();
    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();
  });
});
