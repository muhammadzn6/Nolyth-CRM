// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SessionUser } from "@orbit/contracts";

import { AppHeader } from "./app-header";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { logoutMock, replaceMock } = vi.hoisted(() => ({
  logoutMock: vi.fn(),
  replaceMock: vi.fn(),
}));

vi.mock("../../lib/api-client", () => ({ logout: logoutMock }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
  usePathname: () => "/",
}));

const actor: SessionUser = {
  id: "3a28ef58-ecbd-4bc8-970f-b641918ff368",
  displayName: "Maya Chen",
  email: "maya@orbit.example",
  role: "ADMIN",
  isActive: true,
};

function keydown(element: Element, key: string) {
  element.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key }));
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, reject, resolve };
}

describe("AppHeader user menu", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    logoutMock.mockReset();
    replaceMock.mockReset();

    act(() => root.render(<AppHeader actor={actor} />));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  function trigger(): HTMLButtonElement {
    const element = container.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]');
    if (!element) throw new Error("User menu trigger not found");
    return element;
  }

  function menuItems(): HTMLElement[] {
    return Array.from(container.querySelectorAll<HTMLElement>('[role="menuitem"]'));
  }

  function openMenu() {
    const button = trigger();
    button.focus();
    act(() => button.click());
  }

  function signOut(): HTMLButtonElement {
    const element = menuItems().find((item) => item.textContent === "Sign out");
    if (!(element instanceof HTMLButtonElement)) throw new Error("Sign out item not found");
    return element;
  }

  it("moves focus into the menu and cycles items with ArrowDown and ArrowUp", () => {
    const button = trigger();
    button.focus();

    act(() => button.click());

    const items = menuItems();
    expect(items).toHaveLength(2);
    expect(document.activeElement).toBe(items[0]);

    act(() => keydown(items[0]!, "ArrowDown"));
    expect(document.activeElement).toBe(items[1]);

    act(() => keydown(items[1]!, "ArrowDown"));
    expect(document.activeElement).toBe(items[0]);

    act(() => keydown(items[0]!, "ArrowUp"));
    expect(document.activeElement).toBe(items[1]);
  });

  it("opens on ArrowUp with the last item focused", () => {
    const button = trigger();
    button.focus();

    act(() => keydown(button, "ArrowUp"));

    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(document.activeElement).toBe(menuItems()[1]);
  });

  it("closes on Escape and returns focus to the trigger", () => {
    const button = trigger();
    button.focus();
    act(() => button.click());

    const firstItem = menuItems()[0];
    expect(firstItem).toBeDefined();
    act(() => keydown(firstItem!, "Escape"));

    expect(container.querySelector('[role="menu"]')).toBeNull();
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(button);
  });

  it("disables sign out and exposes pending feedback while logout is in flight", () => {
    const request = deferred<void>();
    logoutMock.mockReturnValue(request.promise);
    openMenu();

    const button = signOut();
    act(() => button.click());

    expect(button.disabled).toBe(true);
    expect(button.textContent).toContain("Signing out…");
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("keeps the menu retryable and focused after logout fails", async () => {
    logoutMock.mockRejectedValueOnce(new Error("API unavailable"));
    openMenu();

    const button = signOut();
    await act(async () => button.click());

    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "Could not sign out. Try again.",
    );
    expect(button.disabled).toBe(false);
    expect(button.textContent).toContain("Sign out");
    expect(document.activeElement).toBe(button);
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("clears the failure and retries logout", async () => {
    logoutMock
      .mockRejectedValueOnce(new Error("API unavailable"))
      .mockRejectedValueOnce(new Error("API still unavailable"));
    openMenu();

    await act(async () => signOut().click());
    expect(container.querySelector('[role="alert"]')).not.toBeNull();

    await act(async () => signOut().click());

    expect(logoutMock).toHaveBeenCalledTimes(2);
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "Could not sign out. Try again.",
    );
  });

  it("redirects only after logout succeeds", async () => {
    const request = deferred<void>();
    logoutMock.mockReturnValue(request.promise);
    openMenu();

    act(() => signOut().click());
    expect(replaceMock).not.toHaveBeenCalled();

    await act(async () => request.resolve(undefined));

    expect(replaceMock).toHaveBeenCalledWith("/login");
  });
});
