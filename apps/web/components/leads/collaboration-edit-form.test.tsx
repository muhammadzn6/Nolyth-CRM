// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CollaborationEditForm } from "./collaboration-edit-form";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const refreshMock = vi.hoisted(() => vi.fn());
const updateLeadCommentMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: refreshMock }) }));
vi.mock("../../lib/api-client", () => ({
  updateLeadComment: updateLeadCommentMock,
  updateLeadCommunication: vi.fn(),
}));

const comment = {
  id: "20000000-0000-4000-8000-000000000001",
  leadId: "30000000-0000-4000-8000-000000000001",
  authorId: "10000000-0000-4000-8000-000000000001",
  body: "Ready for the interview.",
  visibility: "SHARED_WITH_CLOSER" as const,
  archivedAt: null,
  createdAt: "2026-09-09T10:00:00.000Z",
  updatedAt: "2026-09-09T10:00:00.000Z",
  version: 1,
};

describe("CollaborationEditForm", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    refreshMock.mockReset();
    updateLeadCommentMock.mockReset();
    updateLeadCommentMock.mockResolvedValue({ ...comment, version: 2 });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("keeps a closer-owned comment shared while editing", async () => {
    await act(async () => root.render(<CollaborationEditForm item={comment} sharedOnly />));
    const edit = [...container.querySelectorAll("button")].find((button) => button.textContent === "Edit");
    if (!edit) throw new Error("Edit button not found");
    await act(async () => edit.click());

    expect(document.body.textContent).not.toContain("Internal team");
    expect(document.querySelector('select[id^="edit-visibility-"]')).toBeNull();

    const form = document.querySelector("form");
    if (!form) throw new Error("Edit comment form not found");
    await act(async () => form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));

    expect(updateLeadCommentMock).toHaveBeenCalledWith(comment.id, {
      body: comment.body,
      expectedVersion: comment.version,
      visibility: "SHARED_WITH_CLOSER",
    });
  });
});
