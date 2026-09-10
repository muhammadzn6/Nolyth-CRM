// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PasswordForm } from "./password-form";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("../../lib/api-client", () => ({
  ApiClientError: class ApiClientError extends Error {},
  changePassword: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

describe("PasswordForm", () => {
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

  it("provides the signed-in username to password managers", () => {
    act(() => root.render(<PasswordForm username="maya@orbit.example" />));

    const username = container.querySelector<HTMLInputElement>('input[autocomplete="username"]');
    expect(username).not.toBeNull();
    expect(username?.value).toBe("maya@orbit.example");
  });
});
