// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SessionUser, UserSummary } from "@orbit/contracts";

import { UsersPage } from "./users-page";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const {
  createUserMock,
  listUsersMock,
  revokeUserSessionsMock,
  updateUserMock,
  writeTextMock,
} = vi.hoisted(() => ({
  createUserMock: vi.fn(),
  listUsersMock: vi.fn(),
  revokeUserSessionsMock: vi.fn(),
  updateUserMock: vi.fn(),
  writeTextMock: vi.fn(),
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
  createUser: createUserMock,
  listUsers: listUsersMock,
  revokeUserSessions: revokeUserSessionsMock,
  updateUser: updateUserMock,
}));

const admin: SessionUser = {
  id: "00000000-0000-4000-8000-000000000001",
  displayName: "Maya Chen",
  email: "maya@orbit.example",
  role: "ADMIN",
  isActive: true,
};

const bd: SessionUser = {
  ...admin,
  id: "00000000-0000-4000-8000-000000000002",
  email: "avery@orbit.example",
  role: "BD",
};

const activeUser: UserSummary = {
  id: "00000000-0000-4000-8000-000000000003",
  displayName: "Nadia Reed",
  email: "nadia@orbit.example",
  role: "CLOSER",
  isActive: true,
  timezone: "Asia/Karachi",
  lastLoginAt: "2026-09-02T07:00:00.000Z",
};

const inactiveUser: UserSummary = {
  id: "00000000-0000-4000-8000-000000000004",
  displayName: "Avery Morgan",
  email: "avery@orbit.example",
  role: "BD",
  isActive: false,
  timezone: "UTC",
  lastLoginAt: null,
};

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, reject, resolve };
}

function change(element: HTMLInputElement | HTMLSelectElement, value: string) {
  element.value = value;
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("UsersPage", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    listUsersMock.mockReset();
    createUserMock.mockReset();
    updateUserMock.mockReset();
    revokeUserSessionsMock.mockReset();
    writeTextMock.mockReset();
    Object.assign(navigator, {
      clipboard: { writeText: writeTextMock },
    });
    vi.stubEnv("NEXT_PUBLIC_APP_BASE_URL", "https://orbit.example");
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllEnvs();
  });

  async function renderPage(actor: SessionUser = admin) {
    await act(async () => {
      root.render(<UsersPage actor={actor} />);
    });
  }

  it("blocks non-admin actors before loading users", async () => {
    await renderPage(bd);

    expect(container.textContent).toContain("Access restricted");
    expect(listUsersMock).not.toHaveBeenCalled();
  });

  it("shows loading, empty, and retryable error states", async () => {
    const firstLoad = deferred<UserSummary[]>();
    listUsersMock.mockReturnValueOnce(firstLoad.promise);
    await renderPage();

    expect(container.textContent).toContain("Loading admin users");

    await act(async () => firstLoad.resolve([]));
    expect(container.textContent).toContain("No users yet");
    expect(container.textContent).toContain("Invite the first teammate");

    listUsersMock
      .mockRejectedValueOnce(new Error("API down"))
      .mockResolvedValueOnce([activeUser]);
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[aria-label="Refresh users"]')?.click();
    });
    expect(container.textContent).toContain("Users unavailable");

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[aria-label="Retry loading users"]')?.click();
    });
    expect(container.textContent).toContain("Nadia Reed");
  });

  it("lists active and inactive users with role, timezone, and session actions", async () => {
    listUsersMock.mockResolvedValueOnce([activeUser, inactiveUser]);
    await renderPage();

    expect(container.textContent).toContain("Nadia Reed");
    expect(container.textContent).toContain("Active");
    expect(container.textContent).toContain("Avery Morgan");
    expect(container.textContent).toContain("Inactive");
    expect(container.textContent).toContain("Asia/Karachi");
    expect(container.textContent).toContain("Revoke sessions");
  });

  it("creates a user, reveals an invitation link, and copies it", async () => {
    listUsersMock.mockResolvedValueOnce([]);
    createUserMock.mockResolvedValueOnce({
      user: activeUser,
      invitationToken: "opaque-token",
    });
    await renderPage();

    expect(container.querySelector('form[aria-label="Create user invitation"]')).toBeNull();
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[aria-label="Invite user"]')?.click();
    });
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain("Invite teammate");

    change(document.querySelector<HTMLInputElement>("#new-displayName")!, "Nadia Reed");
    change(document.querySelector<HTMLInputElement>("#new-email")!, "NADIA@ORBIT.EXAMPLE");
    change(document.querySelector<HTMLSelectElement>("#new-role")!, "CLOSER");
    change(document.querySelector<HTMLInputElement>("#new-timezone")!, "Asia/Karachi");

    await act(async () => {
      document.querySelector<HTMLFormElement>('form[aria-label="Create user invitation"]')?.requestSubmit();
    });

    expect(createUserMock).toHaveBeenCalledWith({
      displayName: "Nadia Reed",
      email: "NADIA@ORBIT.EXAMPLE",
      role: "CLOSER",
      timezone: "Asia/Karachi",
    });
    expect(container.textContent).toContain("Invitation ready");
    expect(container.textContent).toContain("https://orbit.example/invite/opaque-token");

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[aria-label="Copy invitation link"]')?.click();
    });

    expect(writeTextMock).toHaveBeenCalledWith("https://orbit.example/invite/opaque-token");
    expect(container.textContent).toContain("Invitation link copied");
  });

  it("edits user details, deactivates and reactivates users, and revokes sessions", async () => {
    listUsersMock.mockResolvedValueOnce([activeUser]);
    updateUserMock
      .mockResolvedValueOnce({
        ...activeUser,
        displayName: "Nadia Khan",
        role: "BD",
        timezone: "UTC",
      })
      .mockResolvedValueOnce({
        ...activeUser,
        displayName: "Nadia Khan",
        role: "BD",
        timezone: "UTC",
        isActive: false,
      })
      .mockResolvedValueOnce({
        ...activeUser,
        displayName: "Nadia Khan",
        role: "BD",
        timezone: "UTC",
        isActive: true,
      });
    revokeUserSessionsMock.mockResolvedValue(undefined);
    await renderPage();

    expect(container.querySelector(`form[aria-label="Edit ${activeUser.displayName}"]`)).toBeNull();
    await act(async () => {
      container.querySelector<HTMLButtonElement>(`[aria-label="Edit ${activeUser.displayName}"]`)?.click();
    });
    change(document.querySelector<HTMLInputElement>(`#displayName-${activeUser.id}`)!, "Nadia Khan");
    change(document.querySelector<HTMLSelectElement>(`#role-${activeUser.id}`)!, "BD");
    change(document.querySelector<HTMLInputElement>(`#timezone-${activeUser.id}`)!, "UTC");

    await act(async () => {
      document.querySelector<HTMLFormElement>(`form[aria-label="Edit Nadia Reed"]`)?.requestSubmit();
    });

    expect(updateUserMock).toHaveBeenCalledWith(activeUser.id, {
      displayName: "Nadia Khan",
      role: "BD",
      timezone: "UTC",
    });

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[aria-label="Deactivate Nadia Khan"]')?.click();
    });
    expect(updateUserMock).toHaveBeenLastCalledWith(activeUser.id, { isActive: false });

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[aria-label="Activate Nadia Khan"]')?.click();
    });
    expect(updateUserMock).toHaveBeenLastCalledWith(activeUser.id, { isActive: true });

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[aria-label="Revoke sessions for Nadia Khan"]')?.click();
    });
    expect(revokeUserSessionsMock).toHaveBeenCalledWith(activeUser.id);
    expect(container.textContent).toContain("Sessions revoked for Nadia Khan");
  });
});
