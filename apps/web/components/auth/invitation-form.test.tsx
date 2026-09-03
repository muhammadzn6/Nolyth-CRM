// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { InvitationForm } from "./invitation-form";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { acceptInvitationMock, assignMock } = vi.hoisted(() => ({
  acceptInvitationMock: vi.fn(),
  assignMock: vi.fn(),
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
      this.name = "ApiClientError";
    }
  },
  acceptInvitation: acceptInvitationMock,
}));

function change(element: HTMLInputElement, value: string) {
  element.value = value;
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("InvitationForm", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    acceptInvitationMock.mockReset();
    assignMock.mockReset();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { assign: assignMock },
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  function renderForm(token = "opaque-token") {
    act(() => {
      root.render(<InvitationForm token={token} />);
    });
  }

  it("validates password length and confirmation before accepting", async () => {
    renderForm();

    change(container.querySelector<HTMLInputElement>("#password")!, "short");
    change(container.querySelector<HTMLInputElement>("#confirmPassword")!, "different");

    await act(async () => {
      container.querySelector<HTMLFormElement>('form[aria-label="Accept invitation"]')?.requestSubmit();
    });

    expect(container.textContent).toContain("Use at least 12 characters");
    expect(container.textContent).toContain("Passwords must match");
    expect(acceptInvitationMock).not.toHaveBeenCalled();
  });

  it("accepts a valid invitation and redirects to login after success", async () => {
    acceptInvitationMock.mockResolvedValueOnce({
      id: "00000000-0000-4000-8000-000000000003",
      displayName: "Nadia Reed",
      email: "nadia@orbit.example",
      role: "BD",
      isActive: true,
    });
    renderForm();

    change(container.querySelector<HTMLInputElement>("#password")!, "correct horse battery staple");
    change(container.querySelector<HTMLInputElement>("#confirmPassword")!, "correct horse battery staple");

    await act(async () => {
      container.querySelector<HTMLFormElement>('form[aria-label="Accept invitation"]')?.requestSubmit();
    });

    expect(acceptInvitationMock).toHaveBeenCalledWith({
      token: "opaque-token",
      password: "correct horse battery staple",
    });
    expect(container.textContent).toContain("Password created");
    expect(assignMock).toHaveBeenCalledWith("/login");
  });

  it("shows expired or used invitation guidance for rejected tokens", async () => {
    acceptInvitationMock.mockRejectedValueOnce(
      new Error("Invalid invitation token"),
    );
    renderForm();

    change(container.querySelector<HTMLInputElement>("#password")!, "correct horse battery staple");
    change(container.querySelector<HTMLInputElement>("#confirmPassword")!, "correct horse battery staple");

    await act(async () => {
      container.querySelector<HTMLFormElement>('form[aria-label="Accept invitation"]')?.requestSubmit();
    });

    expect(container.textContent).toContain("Invitation expired or already used");
    expect(container.textContent).toContain("Ask your Orbit administrator for a new invitation link.");
    expect(assignMock).not.toHaveBeenCalled();
  });

  it("blocks empty invitation tokens before sending a password", async () => {
    renderForm("");

    change(container.querySelector<HTMLInputElement>("#password")!, "correct horse battery staple");
    change(container.querySelector<HTMLInputElement>("#confirmPassword")!, "correct horse battery staple");

    await act(async () => {
      container.querySelector<HTMLFormElement>('form[aria-label="Accept invitation"]')?.requestSubmit();
    });

    expect(container.textContent).toContain("Invitation link is invalid");
    expect(acceptInvitationMock).not.toHaveBeenCalled();
  });
});
