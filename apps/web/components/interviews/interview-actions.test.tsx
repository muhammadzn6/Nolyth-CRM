// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const refreshMock = vi.hoisted(() => vi.fn());
const saveInterviewNotesMock = vi.hoisted(() => vi.fn());
const cancelInterviewMock = vi.hoisted(() => vi.fn());
const recordInterviewAttendanceMock = vi.hoisted(() => vi.fn());
const saveOfficialInterviewResultMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: refreshMock }) }));

vi.mock("../../lib/api-client", () => ({
  cancelInterview: cancelInterviewMock,
  recordInterviewAttendance: recordInterviewAttendanceMock,
  saveInterviewNotes: saveInterviewNotesMock,
  saveOfficialInterviewResult: saveOfficialInterviewResultMock,
}));

import { InterviewActions } from "./interview-actions";

function change(element: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

function select(element: HTMLSelectElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set?.call(element, value);
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("InterviewActions", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    refreshMock.mockReset();
    cancelInterviewMock.mockReset();
    cancelInterviewMock.mockResolvedValue({});
    recordInterviewAttendanceMock.mockReset();
    recordInterviewAttendanceMock.mockResolvedValue({});
    saveInterviewNotesMock.mockReset();
    saveInterviewNotesMock.mockResolvedValue({});
    saveOfficialInterviewResultMock.mockReset();
    saveOfficialInterviewResultMock.mockResolvedValue({});
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  it("disables attendance before the scheduled start", () => {
    const html = renderToStaticMarkup(
      <InterviewActions actorRole="CLOSER" id="round-1" startsAt="2099-09-08T14:00:00.000Z" status="SCHEDULED" version={1} />,
    );

    expect(html).toContain("Available after interview starts");
    expect(html).toContain("disabled");
  });

  it("automatically unlocks attendance when the scheduled start passes", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-08T13:59:59.000Z"));
    await act(async () => root.render(
      <InterviewActions actorRole="CLOSER" id="round-1" startsAt="2026-09-08T14:00:00.000Z" status="SCHEDULED" version={1} />,
    ));
    const attended = () => [...container.querySelectorAll("button")].find((button) => button.textContent === "Mark attended") as HTMLButtonElement;

    expect(attended().disabled).toBe(true);
    await act(async () => vi.advanceTimersByTime(999));
    expect(attended().disabled).toBe(true);
    await act(async () => vi.advanceTimersByTime(1));

    expect(attended().disabled).toBe(false);
    expect(container.textContent).not.toContain("Available after interview starts.");
  });

  it("cleans up and reschedules the attendance timer when startsAt changes", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-08T13:59:59.000Z"));
    await act(async () => root.render(
      <InterviewActions actorRole="CLOSER" id="round-1" startsAt="2026-09-08T14:00:00.000Z" status="SCHEDULED" version={1} />,
    ));
    await act(async () => root.render(
      <InterviewActions actorRole="CLOSER" id="round-1" startsAt="2026-09-08T14:00:04.000Z" status="SCHEDULED" version={1} />,
    ));
    const attended = () => [...container.querySelectorAll("button")].find((button) => button.textContent === "Mark attended") as HTMLButtonElement;

    await act(async () => vi.advanceTimersByTime(1_000));
    expect(attended().disabled).toBe(true);
    await act(async () => vi.advanceTimersByTime(4_000));

    expect(attended().disabled).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("prefills the closer's existing notes", () => {
    const html = renderToStaticMarkup(
      <InterviewActions actorRole="CLOSER" closerNotes="Existing closer notes" id="round-1" startsAt="2020-09-08T14:00:00.000Z" status="WAITING_FEEDBACK" version={2} />,
    );

    expect(html).toContain('value="Existing closer notes"');
  });

  it("resets the closer-note draft when the persisted interview id changes", async () => {
    await act(async () => root.render(
      <InterviewActions actorRole="CLOSER" closerNotes="First saved note" id="round-1" startsAt="2020-09-08T14:00:00.000Z" status="WAITING_FEEDBACK" version={2} />,
    ));
    await act(async () => change(container.querySelector("#notes-round-1") as HTMLInputElement, "Unsaved note"));
    await act(async () => root.render(
      <InterviewActions actorRole="CLOSER" closerNotes="Second saved note" id="round-2" startsAt="2020-09-08T14:00:00.000Z" status="WAITING_FEEDBACK" version={2} />,
    ));

    expect((container.querySelector("#notes-round-2") as HTMLInputElement).value).toBe("Second saved note");
  });

  it.each(["WAITING_FEEDBACK", "PASSED", "FAILED", "COMPLETED"])("keeps closer notes editable in the %s state", (status) => {
    const html = renderToStaticMarkup(
      <InterviewActions actorRole="CLOSER" closerNotes="Existing closer notes" id="round-1" startsAt="2020-09-08T14:00:00.000Z" status={status} version={2} />,
    );

    expect(html).toContain('placeholder="Closer notes"');
    expect(html).toContain("Save notes");
  });

  it("refreshes the current route after saving notes", async () => {
    await act(async () => root.render(
      <InterviewActions actorRole="CLOSER" closerNotes="Existing closer notes" id="round-1" startsAt="2020-09-08T14:00:00.000Z" status="WAITING_FEEDBACK" version={2} />,
    ));
    const save = [...container.querySelectorAll("button")].find((button) => button.textContent === "Save notes");
    if (!save) throw new Error("Save notes button not found");

    await act(async () => save.click());

    expect(saveInterviewNotesMock).toHaveBeenCalledWith("round-1", "Existing closer notes", 2);
    expect(refreshMock).toHaveBeenCalledOnce();
  });

  it("closes the cancellation dialog and refreshes after cancellation succeeds", async () => {
    await act(async () => root.render(
      <InterviewActions actorRole="BD" id="round-1" startsAt="2020-09-08T14:00:00.000Z" status="SCHEDULED" version={2} />,
    ));
    const open = [...container.querySelectorAll("button")].find((button) => button.textContent === "Cancel interview");
    if (!open) throw new Error("Cancel interview button not found");
    await act(async () => open.click());

    const reason = document.querySelector(`#cancel-round-1`) as HTMLInputElement | null;
    if (!reason) throw new Error("Cancellation reason input not found");
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(reason, "Recruiter cancelled");
      reason.dispatchEvent(new Event("input", { bubbles: true }));
      reason.dispatchEvent(new Event("change", { bubbles: true }));
    });
    const confirm = [...document.querySelectorAll("button")].reverse().find((button) => button.textContent === "Cancel interview");
    if (!confirm) throw new Error("Cancellation confirmation button not found");
    await act(async () => confirm.click());

    expect(cancelInterviewMock).toHaveBeenCalledWith("round-1", 2, "Recruiter cancelled");
    expect(document.querySelector(`#cancel-round-1`)).toBeNull();
    expect(refreshMock).toHaveBeenCalledOnce();
  });

  it("shows explicit passed and failed outcomes with existing feedback", () => {
    const html = renderToStaticMarkup(
      <InterviewActions actorRole="BD" id="round-1" officialFeedback="Recruiter approved the round" startsAt="2020-09-08T14:00:00.000Z" status="WAITING_FEEDBACK" version={2} />,
    );

    expect(html).toContain("Passed");
    expect(html).toContain("Failed");
    expect(html).toContain("Recruiter approved the round");
  });

  it("preserves legacy free-text results when recording a current outcome", async () => {
    await act(async () => root.render(
      <InterviewActions actorRole="BD" id="round-1" officialResult="Strong legacy recruiter result" startsAt="2020-09-08T14:00:00.000Z" status="WAITING_FEEDBACK" version={3} />,
    ));
    const feedback = container.querySelector("#feedback-round-1") as HTMLInputElement;
    const outcome = container.querySelector("#outcome-round-1") as HTMLSelectElement;

    expect(feedback.value).toBe("Strong legacy recruiter result");
    await act(async () => select(outcome, "PASSED"));
    const save = [...container.querySelectorAll("button")].find((button) => button.textContent === "Save outcome");
    if (!save) throw new Error("Save outcome button not found");
    await act(async () => save.click());

    expect(saveOfficialInterviewResultMock).toHaveBeenCalledWith("round-1", "PASSED", "Strong legacy recruiter result", 3);
  });

  it("keeps legacy completed result text readable as compatibility feedback", () => {
    const html = renderToStaticMarkup(
      <InterviewActions actorRole="BD" id="round-1" officialResult="Legacy recruiter result" startsAt="2020-09-08T14:00:00.000Z" status="COMPLETED" version={2} />,
    );

    expect(html).toContain("Official feedback");
    expect(html).toContain("Legacy recruiter result");
  });

  it("resets official-outcome drafts when the persisted version changes", async () => {
    await act(async () => root.render(
      <InterviewActions actorRole="BD" id="round-1" officialFeedback="First saved feedback" startsAt="2020-09-08T14:00:00.000Z" status="WAITING_FEEDBACK" version={2} />,
    ));
    const feedback = container.querySelector("#feedback-round-1") as HTMLInputElement;
    const outcome = container.querySelector("#outcome-round-1") as HTMLSelectElement;
    await act(async () => {
      change(feedback, "Unsaved feedback");
      select(outcome, "FAILED");
    });
    await act(async () => root.render(
      <InterviewActions actorRole="BD" id="round-1" officialFeedback="Refreshed server feedback" startsAt="2020-09-08T14:00:00.000Z" status="WAITING_FEEDBACK" version={3} />,
    ));

    expect((container.querySelector("#feedback-round-1") as HTMLInputElement).value).toBe("Refreshed server feedback");
    expect((container.querySelector("#outcome-round-1") as HTMLSelectElement).value).toBe("");
  });

  it("keeps closer notes and official feedback visible after the outcome is recorded", () => {
    const html = renderToStaticMarkup(
      <InterviewActions
        actorRole="BD"
        closerNotes="Strong platform architecture discussion"
        id="round-1"
        officialFeedback="Recruiter approved the round"
        officialResult="PASSED"
        startsAt="2020-09-08T14:00:00.000Z"
        status="PASSED"
        version={4}
      />,
    );

    expect(html).toContain("Closer notes");
    expect(html).toContain("Strong platform architecture discussion");
    expect(html).toContain("Official feedback");
    expect(html).toContain("Recruiter approved the round");
  });
});
