// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CollaborationForm } from "./collaboration-form";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const createLeadCommunicationMock = vi.hoisted(() => vi.fn());
const createLeadCommentMock = vi.hoisted(() => vi.fn());
vi.mock("../../lib/api-client", () => ({
  createLeadComment: createLeadCommentMock,
  createLeadCommunication: createLeadCommunicationMock,
}));

const contactId = "80000000-0000-4000-8000-000000000001";
const contacts = [{ id: contactId, name: "Jordan Lee", title: "Recruiter", email: "jordan@example.test" }] as never;

describe("CollaborationForm", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    createLeadCommentMock.mockReset();
    createLeadCommentMock.mockResolvedValue({ id: "comment-1" });
    createLeadCommunicationMock.mockReset();
    createLeadCommunicationMock.mockResolvedValue({ id: "communication-1" });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  function field(label: string): HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement {
    const element = [...container.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("input, textarea, select")]
      .find((candidate) => candidate.labels?.[0]?.textContent === label);
    if (!element) throw new Error(`${label} field not found`);
    return element;
  }

  function change(label: string, value: string) {
    const element = field(label);
    const prototype = element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(element, value);
    element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
  }

  it("submits complete recruiter communication metadata", async () => {
    const onSuccess = vi.fn();
    await act(async () => root.render(<CollaborationForm contacts={contacts} embedded kind="communications" leadId="30000000-0000-4000-8000-000000000001" onSuccess={onSuccess} timezone="America/New_York" />));

    act(() => {
      change("Channel", "EMAIL");
      change("Direction", "INBOUND");
      change("Recruiter or contact", contactId);
      change("Subject", "  Technical interview  ");
      change("Outcome", "Interview requested");
      change("Communication details", "Recruiter requested availability.");
      change("Occurred at", "2026-09-08T10:00");
      change("Next action", "Send availability");
      change("Next action due", "2026-09-08T12:00");
    });
    const form = container.querySelector("form");
    if (!form) throw new Error("Communication form not found");
    await act(async () => form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));

    expect(createLeadCommunicationMock).toHaveBeenCalledWith(
      "30000000-0000-4000-8000-000000000001",
      expect.objectContaining({
        contactId,
        type: "EMAIL",
        direction: "INBOUND",
        subject: "Technical interview",
        outcome: "Interview requested",
        body: "Recruiter requested availability.",
        occurredAt: "2026-09-08T14:00:00.000Z",
        nextActionSummary: "Send availability",
        nextActionDueAt: "2026-09-08T16:00:00.000Z",
      }),
    );
    expect(onSuccess).toHaveBeenCalledOnce();
  });

  it("makes the recruiter-response workflow inbound by default and explains the status change", async () => {
    await act(async () => root.render(
      <CollaborationForm
        embedded
        initialDirection="INBOUND"
        kind="communications"
        leadId="30000000-0000-4000-8000-000000000001"
      />,
    ));

    expect(field("Direction").value).toBe("INBOUND");
    expect(container.textContent).toContain("moves this application to Response received");
  });

  it("keeps closer comments shared without exposing an internal visibility choice", async () => {
    await act(async () => root.render(<CollaborationForm embedded kind="comments" leadId="30000000-0000-4000-8000-000000000001" sharedOnly />));

    expect(container.textContent).not.toContain("Internal team");
    expect(container.querySelector('select[id^="visibility-"]')).toBeNull();

    act(() => change("Comment", "  Ready for the interview.  "));
    const form = container.querySelector("form");
    if (!form) throw new Error("Comment form not found");
    await act(async () => form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));

    expect(createLeadCommentMock).toHaveBeenCalledWith("30000000-0000-4000-8000-000000000001", {
      body: "Ready for the interview.",
      visibility: "SHARED_WITH_CLOSER",
    });
  });
});
