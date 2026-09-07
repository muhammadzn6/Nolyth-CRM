// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { InterviewSummary, LeadSummary, SessionUser, UserSummary } from "@orbit/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CalendarWorkspace } from "./calendar-workspace";

const { createLeadInterviewMock, updateInterviewMock } = vi.hoisted(() => ({ createLeadInterviewMock: vi.fn(), updateInterviewMock: vi.fn() }));
vi.mock("../../lib/api-client", () => ({
  createLeadInterview: createLeadInterviewMock,
  updateInterview: updateInterviewMock,
}));

const actor: SessionUser = {
  id: "00000000-0000-4000-8000-000000000001",
  displayName: "Maya Chen",
  email: "maya@orbit.local",
  role: "ADMIN",
  isActive: true,
};

const interview: InterviewSummary = {
  id: "50000000-0000-4000-8000-000000000001",
  leadId: "60000000-0000-4000-8000-000000000001",
  roundNumber: 1,
  roundType: "TECHNICAL",
  status: "SCHEDULED",
  closerId: "00000000-0000-4000-8000-000000000002",
  creatorId: actor.id,
  startsAt: "2026-09-03T09:30:00.000Z",
  endsAt: "2026-09-03T10:15:00.000Z",
  timezone: "Asia/Karachi",
  originalDatetimeText: "September 3 at 2:30 PM",
  interviewer: "Jordan Lee",
  meetingLink: "https://meet.example.com/orbit",
  location: null,
  preparationNotes: "Review system design.",
  closerNotes: null,
  officialFeedback: null,
  officialResult: null,
  attendance: null,
  googleSyncStatus: "SYNCED",
  version: 1,
  createdAt: "2026-09-01T08:00:00.000Z",
  updatedAt: "2026-09-01T08:00:00.000Z",
};

describe("CalendarWorkspace", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-04T12:00:00.000Z"));
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  it("provides month, week, day, and agenda views with calendar filters", async () => {
    await act(async () => root.render(<CalendarWorkspace actor={actor} interviews={[interview]} />));

    const previousButton = Array.from(container.querySelectorAll("button")).find((button) => button.getAttribute("aria-label") === "Previous period");
    await act(async () => previousButton?.click());

    expect(container.textContent).toContain("M");
    expect(container.textContent).toContain("W");
    expect(container.textContent).toContain("D");
    expect(container.textContent).toContain("Agenda");
    await act(async () => (container.querySelector('[aria-label="Open calendar display settings"]') as HTMLButtonElement).click());
    expect(container.textContent).toContain("All calendars");
    expect(container.textContent).toContain("Orbit interviews");
    expect(container.textContent).toContain("00:00");
    expect(container.querySelector('[aria-label="Calendar view"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Open calendar display settings"]')).not.toBeNull();
  });

  it("orders calendar views from day to month and keeps agenda in a fixed viewport", async () => {
    await act(async () => root.render(<CalendarWorkspace actor={actor} interviews={[interview]} />));

    const controls = container.querySelectorAll('[aria-label="Calendar controls"]')[0];
    expect(Array.from(controls?.querySelectorAll("button") ?? []).map((button) => button.textContent)).toEqual(["Today", "‹", "›", "D", "W", "M", "Agenda", ""]);
    expect(Array.from(controls?.querySelectorAll("button") ?? []).find((button) => button.textContent === "D")?.getAttribute("aria-pressed")).toBe("true");

    const agendaButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Agenda");
    await act(async () => agendaButton?.click());
    expect(container.querySelector('[data-testid="calendar-view-scroll"]')?.className).toContain("h-[680px]");
  });

  it("shows a useful empty agenda state instead of a blank panel", async () => {
    await act(async () => root.render(<CalendarWorkspace actor={actor} interviews={[]} />));

    const agendaButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Agenda");
    await act(async () => agendaButton?.click());

    expect(container.querySelector('[aria-label="Empty calendar agenda"]')).not.toBeNull();
    expect(container.textContent).toContain("Your agenda is clear");
    expect(container.textContent).not.toContain("No calendar events match the selected filters");
  });

  it("shows dual timezone labels and a current-time anchor in time views", async () => {
    await act(async () => root.render(<CalendarWorkspace actor={actor} interviews={[interview]} />));

    const todayButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Today");
    await act(async () => todayButton?.click());

    expect(container.querySelector('[data-testid="calendar-timezone-us"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="calendar-timezone-pakistan"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="calendar-current-time"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="calendar-time-scroll"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Calendar view"]')?.textContent).toMatch(/20\d{2}/);
    expect(container.querySelector('[data-testid="calendar-time-grid"]')?.textContent).not.toContain(", 2026");
  });

  it("keeps timezone rails readable while staying compact", async () => {
    await act(async () => root.render(<CalendarWorkspace actor={actor} interviews={[interview]} />));

    const weekButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "W");
    await act(async () => weekButton?.click());

    expect(container.querySelector('[data-testid="calendar-time-grid"] > div')?.getAttribute("style")).toContain("4.5rem repeat(7");
  });

  it("contains the wide calendar grid within the available viewport", async () => {
    await act(async () => root.render(<CalendarWorkspace actor={actor} interviews={[]} embedded />));

    const calendar = container.querySelector('[aria-label="Calendar view"]');
    expect(calendar?.className).toContain("min-w-0");
    expect(calendar?.className).toContain("max-w-full");
    expect(calendar?.className).toContain("overflow-hidden");
  });

  it("switches to the agenda view and opens event details", async () => {
    await act(async () => root.render(<CalendarWorkspace actor={actor} interviews={[interview]} />));

    const agendaButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Agenda");
    await act(async () => agendaButton?.click());
    expect(container.querySelector('[aria-label="Calendar view"]')?.textContent).toContain("Agenda");

    const event = container.querySelector('[data-testid="calendar-event"]');
    await act(async () => (event as HTMLElement)?.click());
    expect(container.textContent).toContain("Interview details");
    expect(container.textContent).toContain("Jordan Lee");
  });

  it("filters interview events when the Orbit calendar is toggled off", async () => {
    await act(async () => root.render(<CalendarWorkspace actor={{ ...actor, role: "CLOSER" }} interviews={[interview]} />));

    await act(async () => (container.querySelector('[aria-label="Open calendar display settings"]') as HTMLButtonElement).click());
    const orbitCalendar = Array.from(container.querySelectorAll("input")).find((input) => input.parentElement?.textContent?.includes("Orbit interviews"));
    await act(async () => orbitCalendar?.click());

    expect(container.textContent).not.toContain("Orbit interviews in view");
    expect(container.textContent).not.toContain("No events in this scope");
    expect(container.querySelector('[data-testid="calendar-event"]')).toBeNull();
  });

  it("renders week and day views as time grids", async () => {
    await act(async () => root.render(<CalendarWorkspace actor={actor} interviews={[interview]} />));

    const weekButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "W");
    await act(async () => weekButton?.click());
    expect(container.querySelector('[data-testid="calendar-time-grid"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="calendar-hour"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="calendar-timezone-column-America-New_York"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="calendar-event"]')).not.toBeNull();

    const dayButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "D");
    await act(async () => dayButton?.click());
    expect(container.querySelectorAll('[data-testid="calendar-day-column"]')).toHaveLength(1);
  });

  it("navigates between calendar days", async () => {
    await act(async () => root.render(<CalendarWorkspace actor={actor} interviews={[]} />));

    const calendar = container.querySelector('[aria-label="Calendar view"]');
    const before = calendar?.textContent;
    const nextButton = Array.from(container.querySelectorAll("button")).find((button) => button.getAttribute("aria-label") === "Next period");
    await act(async () => nextButton?.click());

    expect(calendar?.textContent).not.toBe(before);
  });

  it("opens directly on the supplied calendar date", async () => {
    await act(async () => root.render(<CalendarWorkspace actor={actor} interviews={[]} initialDate="2026-09-08T09:00:00.000Z" />));

    expect(container.querySelector('[aria-label="Calendar view"]')?.textContent).toContain("Tue, Sep 8");
  });

  it("shows the month beside the first day of a month in week view", async () => {
    await act(async () => root.render(<CalendarWorkspace actor={actor} interviews={[]} />));

    const weekButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "W");
    await act(async () => weekButton?.click());

    expect(container.querySelector('[data-testid="calendar-time-grid"]')?.textContent).toContain("Sep 1");
    expect(container.querySelector('[data-testid="calendar-time-grid"]')?.textContent).not.toContain("Sep 1, 2026");
  });

  it("shows the year on the first day in month view", async () => {
    await act(async () => root.render(<CalendarWorkspace actor={actor} interviews={[]} />));

    const monthButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "M");
    await act(async () => monthButton?.click());

    expect(container.querySelector('[data-testid="calendar-active-month-date"]')?.textContent).toContain("Sep 1");
    expect(container.querySelector('[data-testid="calendar-active-month-date"]')?.textContent).not.toContain("Sep 1, 2026");
  });

  it("visually separates inactive overflow dates in month view", async () => {
    await act(async () => root.render(<CalendarWorkspace actor={actor} interviews={[]} />));

    const monthButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "M");
    await act(async () => monthButton?.click());

    expect(container.querySelectorAll('[data-testid="calendar-inactive-month-date"]')).not.toHaveLength(0);
    expect(container.querySelectorAll('[data-testid="calendar-active-month-date"]')).not.toHaveLength(0);
  });

  it("keeps Admin calendars scoped until All calendars is enabled", async () => {
    const otherInterview = { ...interview, id: "50000000-0000-4000-8000-000000000002", creatorId: "00000000-0000-4000-8000-000000000009" };
    await act(async () => root.render(<CalendarWorkspace actor={actor} interviews={[interview, otherInterview]} initialDate="2026-09-03T09:00:00.000Z" />));

    expect(container.querySelectorAll('[data-testid="calendar-event"]')).toHaveLength(1);
    await act(async () => (container.querySelector('[aria-label="Open calendar display settings"]') as HTMLButtonElement).click());
    const allCalendars = Array.from(container.querySelectorAll("input")).find((input) => input.parentElement?.textContent?.includes("All calendars"));
    await act(async () => allCalendars?.click());
    expect(container.querySelectorAll('[data-testid="calendar-event"]')).toHaveLength(2);
  });

  it("keeps filters inside the single display settings popover", async () => {
    await act(async () => root.render(<CalendarWorkspace actor={actor} interviews={[interview]} />));

    const settings = container.querySelector('[aria-label="Open calendar display settings"]') as HTMLButtonElement;
    await act(async () => settings.click());

    expect(container.textContent).toContain("Status");
    expect(container.textContent).toContain("Interview type");
    expect(container.querySelectorAll('[aria-label="Open calendar display settings"]')).toHaveLength(1);
    expect(container.querySelector('[aria-label="Open calendar filters"]')).toBeNull();
  });

  it("opens scheduling from an empty time slot", async () => {
    const lead = { id: "60000000-0000-4000-8000-000000000001", jobTitle: "Backend Engineer", companyName: "Google" } as LeadSummary;
    const closer = { id: "00000000-0000-4000-8000-000000000002", displayName: "Noah Patel", role: "CLOSER", isActive: true, email: "noah@example.com", timezone: "Asia/Karachi", lastLoginAt: null } as UserSummary;
    await act(async () => root.render(<CalendarWorkspace actor={{ ...actor, role: "BD" }} interviews={[]} leads={[lead]} closers={[closer]} />));

    const slot = container.querySelector('[data-testid="calendar-hour-slot"]') as HTMLButtonElement;
    await act(async () => slot.click());

    expect(container.textContent).toContain("Schedule interview");
    expect(container.querySelector('[aria-label="Schedule interview"]')).not.toBeNull();
    expect(container.textContent).toContain("Backend Engineer · Google");
  });

  it("makes interview events draggable and exposes drop targets", async () => {
    await act(async () => root.render(<CalendarWorkspace actor={actor} interviews={[interview]} initialDate="2026-09-03T09:00:00.000Z" />));
    expect(container.querySelector('[data-testid="calendar-event"]')?.getAttribute("draggable")).toBe("true");
    expect(container.querySelector('[data-testid="calendar-hour-slot"]')).not.toBeNull();
  });
});
