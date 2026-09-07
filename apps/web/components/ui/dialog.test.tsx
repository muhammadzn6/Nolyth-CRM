// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Dialog } from "./dialog";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("Dialog", () => {
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

  it("labels the modal, moves focus inside, and closes on Escape", () => {
    const onOpenChange = vi.fn();
    act(() => root.render(<Dialog description="Create a record" onOpenChange={onOpenChange} open title="Add candidate"><input aria-label="Candidate name" /></Dialog>));

    const dialog = document.body.querySelector('[role="dialog"]');
    expect(dialog?.getAttribute("aria-modal")).toBe("true");
    expect(dialog?.textContent).toContain("Add candidate");
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Close Add candidate");

    act(() => dialog?.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Escape" })));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
