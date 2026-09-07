// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { InterviewSummary } from "@orbit/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BdCalendarPreview } from "./bd-calendar-preview";

const interview = {
  id: "50000000-0000-4000-8000-000000000001",
  leadId: "60000000-0000-4000-8000-000000000001",
  roundNumber: 1,
  roundType: "TECHNICAL",
  startsAt: "2026-09-08T09:00:00.000Z",
  endsAt: "2026-09-08T10:00:00.000Z",
  timezone: "Asia/Karachi",
  status: "SCHEDULED",
  closerId: "00000000-0000-4000-8000-000000000002",
  creatorId: "00000000-0000-4000-8000-000000000003",
  interviewer: "Jordan Lee",
  location: null,
  meetingLink: null,
  preparationNotes: null,
  closerNotes: null,
  officialFeedback: null,
  officialResult: null,
  attendance: null,
  googleSyncStatus: "SYNCED",
  originalDatetimeText: "September 8, 2026 at 2:00 PM",
  version: 1,
  createdAt: "2026-09-01T08:00:00.000Z",
  updatedAt: "2026-09-01T08:00:00.000Z",
} as InterviewSummary;

describe("BD calendar preview", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    const now = new Date("2026-09-06T12:00:00.000Z");
    vi.setSystemTime(now);
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("renders one compact calendar surface without a duplicate upcoming-interviews module", async () => {
    await act(async () => root.render(<BdCalendarPreview interviews={[interview]} />));

    expect(container.querySelector('[aria-label="BD calendar"]')).not.toBeNull();
    expect(container.querySelector("h2")?.textContent).toBe("September 2026");
    expect(container.querySelector('[aria-label="BD upcoming interviews"]')).toBeNull();
    expect(container.querySelectorAll("[data-testid=bd-mini-calendar-date]")).toHaveLength(42);
    expect(Array.from(container.querySelectorAll(".bd-mini-calendar-count")).map((node) => node.textContent)).not.toContain("0");
  });

  it("renders Day view as a 24-hour scrollable timeline with US and Pakistan labels", async () => {
    const scrollTo = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollTo", { configurable: true, value: scrollTo });
    await act(async () => root.render(<BdCalendarPreview interviews={[interview]} />));

    const dayButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "D");
    await act(async () => dayButton?.click());

    expect(container.querySelectorAll("[data-testid=bd-mini-calendar-weekday]")).toHaveLength(0);
    expect(container.querySelectorAll("[data-testid=bd-mini-time-row]")).toHaveLength(24);
    expect(container.querySelector('[data-testid="bd-mini-time-grid"]')?.textContent).toContain("US ET");
    expect(container.querySelector('[data-testid="bd-mini-time-grid"]')?.textContent).toContain("PKT");
    expect(container.querySelector('[data-testid="bd-mini-time-grid"]')?.className).toContain("overflow-y-auto");
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ behavior: "smooth" }));
    expect(dayButton?.getAttribute("aria-label")).toBe("Day calendar view");
  });

  it("centers the current business hour relative to the scroll container", async () => {
    const scrollTo = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollTo", { configurable: true, value: scrollTo });
    Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get() { return this.dataset.testid === "bd-mini-time-grid" ? 260 : 40; } });
    Object.defineProperty(HTMLElement.prototype, "scrollTop", { configurable: true, writable: true, value: 300 });
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      const top = this.dataset.testid === "bd-mini-time-grid" ? 100 : this.dataset.hour === "8" ? 440 : 0;
      return { top, bottom: top + 40, left: 0, right: 0, width: 0, height: 40, x: 0, y: top, toJSON: () => ({}) };
    });
    await act(async () => root.render(<BdCalendarPreview interviews={[interview]} />));

    const dayButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "D");
    await act(async () => dayButton?.click());

    expect(scrollTo).toHaveBeenLastCalledWith({ behavior: "smooth", top: 530 });
  });

  it("keeps Week view fixed and scrolls each day column instead of growing the card", async () => {
    await act(async () => root.render(<BdCalendarPreview interviews={[interview]} />));

    const weekButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "W");
    await act(async () => weekButton?.click());

    expect(container.querySelectorAll("[data-testid=bd-mini-calendar-date]")).toHaveLength(7);
    expect(container.querySelector('[data-testid="bd-mini-week-grid"]')?.className).toContain("bd-mini-week-grid");
    expect(container.querySelectorAll(".bd-mini-calendar-event")).toHaveLength(1);
  });
});
