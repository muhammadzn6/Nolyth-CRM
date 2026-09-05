// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { InterviewSummary, SessionUser } from "@orbit/contracts";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { CalendarWorkspace } from "./calendar-workspace";

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
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("provides month, week, day, and agenda views with calendar filters", async () => {
    await act(async () => root.render(<CalendarWorkspace actor={actor} interviews={[interview]} />));

    expect(container.textContent).toContain("Month");
    expect(container.textContent).toContain("Week");
    expect(container.textContent).toContain("Day");
    expect(container.textContent).toContain("Agenda");
    expect(container.textContent).toContain("All calendars");
    expect(container.textContent).toContain("Orbit interviews");
    expect(container.textContent).toContain("2:30 PM");
    expect(container.querySelector('[aria-label="Calendar view"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Open calendar filters"]')).not.toBeNull();
  });

  it("shows dual timezone labels and a current-time anchor in time views", async () => {
    await act(async () => root.render(<CalendarWorkspace actor={actor} interviews={[interview]} />));

    expect(container.querySelector('[data-testid="calendar-timezone-us"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="calendar-timezone-pakistan"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="calendar-current-time"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="calendar-time-scroll"]')).not.toBeNull();
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

    const orbitCalendar = Array.from(container.querySelectorAll("input")).find((input) => input.parentElement?.textContent?.includes("Orbit interviews"));
    await act(async () => orbitCalendar?.click());

    expect(container.textContent).toContain("0 Orbit interviews");
    expect(container.textContent).toContain("No events in this scope");
    expect(container.querySelector('[data-testid="calendar-event"]')).toBeNull();
  });

  it("renders week and day views as time grids", async () => {
    await act(async () => root.render(<CalendarWorkspace actor={actor} interviews={[interview]} />));

    const weekButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Week");
    await act(async () => weekButton?.click());
    expect(container.querySelector('[data-testid="calendar-time-grid"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="calendar-hour"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="calendar-event"]')).not.toBeNull();

    const dayButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Day");
    await act(async () => dayButton?.click());
    expect(container.querySelectorAll('[data-testid="calendar-day-column"]')).toHaveLength(1);
  });

  it("keeps Admin calendars scoped until All calendars is enabled", async () => {
    const otherInterview = { ...interview, id: "50000000-0000-4000-8000-000000000002", creatorId: "00000000-0000-4000-8000-000000000009" };
    await act(async () => root.render(<CalendarWorkspace actor={actor} interviews={[interview, otherInterview]} />));

    expect(container.textContent).toContain("1 Orbit interview in view");
    const allCalendars = Array.from(container.querySelectorAll("input")).find((input) => input.parentElement?.textContent?.includes("All calendars"));
    await act(async () => allCalendars?.click());
    expect(container.textContent).toContain("2 Orbit interviews in view");
  });

  it("uses the supplied date as its initial calendar anchor", async () => {
    await act(async () => root.render(<CalendarWorkspace actor={actor} interviews={[]} initialDate="2026-09-08T09:00:00.000Z" />));

    expect(container.querySelector('[aria-label="Calendar view"]')?.textContent).toContain("Tue, Sep 8");
  });
});
