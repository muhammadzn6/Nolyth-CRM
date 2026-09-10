// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import type { InterviewSummary } from "@orbit/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { InterviewEditForm, InterviewRoundCard } from "./interview-edit-form";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { updateInterviewMock } = vi.hoisted(() => ({
  updateInterviewMock: vi.fn(),
}));
const refreshMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: refreshMock }) }));
vi.mock("../../lib/api-client", () => ({
  updateInterview: updateInterviewMock,
}));

function change(element: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

function changeTextarea(element: HTMLTextAreaElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set?.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

const round = {
  id: "00000000-0000-4000-8000-000000000401",
  leadId: "00000000-0000-4000-8000-000000000201",
  roundNumber: 1,
  roundType: "TECHNICAL",
  startsAt: "2026-09-08T09:00:00.000Z",
  endsAt: "2026-09-08T10:00:00.000Z",
  timezone: "Asia/Karachi",
  status: "SCHEDULED",
  closerId: "00000000-0000-4000-8000-000000000501",
  creatorId: "00000000-0000-4000-8000-000000000101",
  interviewer: "Jordan Lee",
  location: null,
  meetingLink: null,
  preparationNotes: null,
  closerNotes: null,
  officialFeedback: null,
  officialResult: null,
  attendance: null,
  googleSyncStatus: "SYNCED",
  originalDatetimeText: "September 8, 2026 at 14:00",
  version: 1,
  createdAt: "2026-09-05T10:00:00.000Z",
  updatedAt: "2026-09-05T10:00:00.000Z",
} as InterviewSummary;

describe("InterviewRoundCard", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    updateInterviewMock.mockReset();
    refreshMock.mockReset();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("shows an operational briefing with explicit edit and cancel actions", () => {
    const html = renderToStaticMarkup(<InterviewRoundCard actorRole="BD" closerName="Noah Patel" round={{
      ...round,
      meetingLink: "https://meet.example/interview",
      preparationNotes: "Review the system design portfolio.",
    }} />);

    expect(html).toContain("Edit interview");
    expect(html).toContain("Cancel interview");
    expect(html).toContain("15:00");
    expect(html).toContain("60 min");
    expect(html).toContain("Noah Patel");
    expect(html).toContain("Join meeting");
    expect(html).toContain("Review the system design portfolio.");
    expect(html).toContain('aria-label="Interview with Jordan Lee"');
    expect(html).not.toContain("Cancellation reason");
    expect(html).not.toContain("Mark attended");
  });

  it("wires persisted notes and feedback into the round actions", () => {
    const html = renderToStaticMarkup(<InterviewRoundCard actorRole="CLOSER" closerName="Noah Patel" round={{
      ...round,
      status: "FAILED",
      closerNotes: "Saved closer assessment",
      officialFeedback: "Recruiter declined after the round",
      officialResult: "FAILED",
      version: 4,
    }} />);

    expect(html).toContain('value="Saved closer assessment"');
    expect(html).toContain("Recruiter declined after the round");
    expect(html).toContain("Save notes");
  });

  it("renders stored instants as wall time in the interview timezone", () => {
    const html = renderToStaticMarkup(
      <InterviewEditForm
        onCancel={() => undefined}
        round={{
          ...round,
          startsAt: "2026-09-08T14:00:00.000Z",
          endsAt: "2026-09-08T15:00:00.000Z",
          timezone: "America/New_York",
        }}
      />,
    );

    expect(html).toContain('value="2026-09-08T10:00"');
    expect(html).toContain('value="2026-09-08T11:00"');
  });

  it("rejects an end time that is not after the start time without updating", async () => {
    await act(async () => root.render(<InterviewEditForm onCancel={() => undefined} round={round} />));

    const starts = container.querySelector('input[type="datetime-local"]') as HTMLInputElement;
    const ends = container.querySelectorAll('input[type="datetime-local"]')[1] as HTMLInputElement;
    await act(async () => {
      change(starts, "2026-09-08T11:00");
      change(ends, "2026-09-08T10:00");
    });
    await act(async () => container.querySelector("form")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));

    expect(updateInterviewMock).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toBe("End time must be after the start time.");
    expect(starts.value).toBe("2026-09-08T11:00");
    expect(ends.value).toBe("2026-09-08T10:00");
  });

  it("resets controlled drafts when the persisted interview version changes", async () => {
    await act(async () => root.render(<InterviewEditForm onCancel={() => undefined} round={round} />));

    const inputs = [...container.querySelectorAll("input")] as HTMLInputElement[];
    await act(async () => {
      change(inputs[0], "2026-09-10T12:00");
      change(inputs[2], "America/New_York");
      change(inputs[3], "Unsaved interviewer");
      change(inputs[4], "https://draft.example/interview");
      changeTextarea(container.querySelector("textarea") as HTMLTextAreaElement, "Unsaved preparation");
    });

    await act(async () => root.render(
      <InterviewEditForm
        onCancel={() => undefined}
        round={{
          ...round,
          version: 2,
          startsAt: "2026-09-09T06:00:00.000Z",
          endsAt: "2026-09-09T07:30:00.000Z",
          timezone: "Asia/Karachi",
          interviewer: "Refreshed interviewer",
          meetingLink: "https://server.example/interview",
          preparationNotes: "Refreshed preparation",
        }}
      />,
    ));

    const refreshedInputs = [...container.querySelectorAll("input")] as HTMLInputElement[];
    expect(refreshedInputs.map((input) => input.value)).toEqual([
      "2026-09-09T11:00",
      "2026-09-09T12:30",
      "Asia/Karachi",
      "Refreshed interviewer",
      "https://server.example/interview",
    ]);
    expect((container.querySelector("textarea") as HTMLTextAreaElement).value).toBe("Refreshed preparation");
  });

  it("closes the editor and refreshes the current route after a successful update", async () => {
    const onCancel = vi.fn();
    updateInterviewMock.mockResolvedValue({ ...round, version: 2 });
    await act(async () => root.render(<InterviewEditForm onCancel={onCancel} round={round} />));

    await act(async () => container.querySelector("form")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));

    expect(updateInterviewMock).toHaveBeenCalledOnce();
    expect(onCancel).toHaveBeenCalledOnce();
    expect(refreshMock).toHaveBeenCalledOnce();
  });
});
