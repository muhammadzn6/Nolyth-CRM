// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SessionUser } from "@orbit/contracts";

import { AppShell } from "./app-shell";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/",
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const actor: SessionUser = {
  id: "3a28ef58-ecbd-4bc8-970f-b641918ff368",
  displayName: "Maya Chen",
  email: "maya@orbit.example",
  role: "ADMIN",
  isActive: true,
};

describe("AppShell interactions", () => {
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

  it("keeps desktop content padding aligned with the sidebar width", () => {
    act(() => {
      root.render(
        <AppShell actor={actor}>
          <p>Dashboard content</p>
        </AppShell>,
      );
    });

    const sidebar = container.querySelector("aside");
    const content = container.querySelector("main")?.parentElement;
    const collapse = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Collapse navigation"]',
    );

    expect(sidebar?.className).toContain("w-[224px]");
    expect(content?.className).toContain("lg:pl-[224px]");

    act(() => collapse?.click());

    expect(sidebar?.className).toContain("w-[76px]");
    expect(content?.className).toContain("lg:pl-[76px]");
  });
});
