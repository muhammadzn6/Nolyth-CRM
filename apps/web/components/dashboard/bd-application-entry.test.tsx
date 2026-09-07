// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { BdApplicationEntry } from "./bd-application-entry";

describe("BdApplicationEntry", () => {
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

  it("keeps the application form closed until the primary action is used", async () => {
    await act(async () => root.render(<BdApplicationEntry actorId="00000000-0000-4000-8000-000000000001" profiles={[]} />));

    expect(container.querySelector('[aria-label="Add application"]')).not.toBeNull();
    expect(document.querySelector('[aria-label="Add application modal"]')).toBeNull();

    await act(async () => (container.querySelector('[aria-label="Add application"]') as HTMLButtonElement).click());

    expect(document.querySelector('[aria-label="Add application modal"]')).not.toBeNull();
    expect(document.querySelector('[aria-label="Add application modal"]')?.textContent).toContain("Add application");
  });
});
