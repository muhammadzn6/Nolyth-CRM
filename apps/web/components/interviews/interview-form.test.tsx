// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { UserSummary } from "@orbit/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { InterviewForm } from "./interview-form";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { createLeadInterviewMock } = vi.hoisted(() => ({
  createLeadInterviewMock: vi.fn(),
}));

vi.mock("../../lib/api-client", () => ({
  createLeadInterview: createLeadInterviewMock,
}));

const leadId = "60000000-0000-4000-8000-000000000001";
const closer = {
  id: "00000000-0000-4000-8000-000000000002",
  displayName: "Noah Patel",
  email: "noah@orbit.local",
  role: "CLOSER",
  isActive: true,
  timezone: "America/New_York",
  lastLoginAt: null,
} as UserSummary;

function change(element: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(
    element,
    value,
  );
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("InterviewForm", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    createLeadInterviewMock.mockReset();
    createLeadInterviewMock.mockRejectedValue(new Error("Stop after capture"));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("submits interview wall time in the candidate timezone", async () => {
    await act(async () =>
      root.render(
        <InterviewForm
          closers={[closer]}
          leadId={leadId}
          timezone="America/New_York"
        />,
      ),
    );

    const starts = container.querySelector(
      'input[type="datetime-local"]',
    ) as HTMLInputElement;
    const ends = container.querySelectorAll(
      'input[type="datetime-local"]',
    )[1] as HTMLInputElement;
    await act(async () => {
      change(starts, "2026-09-08T10:00");
      change(ends, "2026-09-08T11:00");
    });
    await act(async () =>
      container.querySelector("form")?.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      ),
    );

    expect(createLeadInterviewMock).toHaveBeenCalledWith(
      leadId,
      expect.objectContaining({
        startsAt: "2026-09-08T14:00:00.000Z",
        endsAt: "2026-09-08T15:00:00.000Z",
        timezone: "America/New_York",
      }),
    );
  });

  it("rejects an end time that is not after the start time without clearing the form", async () => {
    await act(async () => root.render(<InterviewForm closers={[closer]} leadId={leadId} timezone="America/New_York" />));

    const starts = container.querySelector('input[type="datetime-local"]') as HTMLInputElement;
    const ends = container.querySelectorAll('input[type="datetime-local"]')[1] as HTMLInputElement;
    await act(async () => {
      change(starts, "2026-09-08T11:00");
      change(ends, "2026-09-08T10:00");
    });
    await act(async () => container.querySelector("form")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));

    expect(createLeadInterviewMock).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toBe("End time must be after the start time.");
    expect(starts.value).toBe("2026-09-08T11:00");
    expect(ends.value).toBe("2026-09-08T10:00");
  });

  it("keeps wall-time values when timezone conversion fails", async () => {
    await act(async () => root.render(<InterviewForm closers={[closer]} leadId={leadId} timezone="America/New_York" />));

    const starts = container.querySelector('input[type="datetime-local"]') as HTMLInputElement;
    const ends = container.querySelectorAll('input[type="datetime-local"]')[1] as HTMLInputElement;
    await act(async () => {
      change(starts, "2026-03-08T02:30");
      change(ends, "2026-03-08T03:30");
    });
    await act(async () => container.querySelector("form")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));

    expect(createLeadInterviewMock).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("does not exist");
    expect(starts.value).toBe("2026-03-08T02:30");
    expect(ends.value).toBe("2026-03-08T03:30");
  });

  it("shows visible progress while an interview is being scheduled", async () => {
    let finishRequest: (() => void) | undefined;
    createLeadInterviewMock.mockImplementationOnce(
      () => new Promise<void>((resolve) => { finishRequest = resolve; }),
    );
    await act(async () =>
      root.render(
        <InterviewForm
          closers={[closer]}
          leadId={leadId}
          timezone="America/New_York"
        />,
      ),
    );

    const starts = container.querySelector('input[type="datetime-local"]') as HTMLInputElement;
    const ends = container.querySelectorAll('input[type="datetime-local"]')[1] as HTMLInputElement;
    await act(async () => {
      change(starts, "2026-09-08T10:00");
      change(ends, "2026-09-08T11:00");
    });
    await act(async () => {
      container.querySelector("form")?.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
      await Promise.resolve();
    });

    const submit = container.querySelector<HTMLButtonElement>('button[type="submit"]');
    expect(submit?.disabled).toBe(true);
    expect(submit?.getAttribute("aria-busy")).toBe("true");
    expect(submit?.querySelector('[data-orbit-spinner="true"]')).not.toBeNull();

    await act(async () => finishRequest?.());
  });
});
