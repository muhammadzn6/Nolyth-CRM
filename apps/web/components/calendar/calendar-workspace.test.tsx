// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { InterviewSummary, LeadSummary, SessionUser, UserSummary } from "@orbit/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CalendarWorkspace, slotDateTimeValue } from "./calendar-workspace";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { createLeadInterviewMock, updateInterviewMock } = vi.hoisted(() => ({ createLeadInterviewMock: vi.fn(), updateInterviewMock: vi.fn() }));
const refreshMock = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: refreshMock }) }));
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

function change(element: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

function select(element: HTMLSelectElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set?.call(element, value);
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

function dropInterview(element: HTMLElement, interviewId: string, hour: number) {
  const drop = new Event("drop", { bubbles: true, cancelable: true });
  Object.defineProperties(drop, {
    clientY: { value: hour * 64 },
    dataTransfer: { value: { getData: () => interviewId } },
  });
  element.dispatchEvent(drop);
}

describe("slotDateTimeValue", () => {
  it("preserves a numeric spring-forward grid hour without browser-local normalization", () => {
    const originalTimezone = process.env.TZ;
    process.env.TZ = "America/New_York";

    try {
      expect(slotDateTimeValue(new Date(2026, 2, 8), 2)).toBe("2026-03-08T02:00");
    } finally {
      if (originalTimezone === undefined) delete process.env.TZ;
      else process.env.TZ = originalTimezone;
    }
  });
});

describe("CalendarWorkspace", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-04T12:00:00.000Z"));
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    createLeadInterviewMock.mockReset();
    createLeadInterviewMock.mockRejectedValue(new Error("Stop after capture"));
    updateInterviewMock.mockReset();
    refreshMock.mockReset();
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

  it("anchors Today and event grouping to the configured business timezone", async () => {
    vi.setSystemTime(new Date("2026-09-09T02:30:00.000Z"));
    const boundaryInterview = {
      ...interview,
      startsAt: "2026-09-09T01:30:00.000Z",
      endsAt: "2026-09-09T02:15:00.000Z",
    };

    await act(async () => root.render(
      <CalendarWorkspace
        actor={actor}
        businessTimeZone="America/New_York"
        interviews={[boundaryInterview]}
      />,
    ));

    expect(container.querySelector('[aria-label="Calendar view"]')?.textContent).toContain("Tue, Sep 8, 2026");
    const event = container.querySelector('[data-testid="calendar-event"]');
    expect(event).not.toBeNull();
    expect((event?.parentElement as HTMLElement).style.top).toBe("1376px");
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

  it("updates open event details from refreshed interview props", async () => {
    await act(async () => root.render(<CalendarWorkspace actor={actor} interviews={[interview]} initialDate="2026-09-03T09:00:00.000Z" />));
    await act(async () => (container.querySelector('[data-testid="calendar-event"]') as HTMLButtonElement).click());

    await act(async () => root.render(
      <CalendarWorkspace
        actor={actor}
        interviews={[{
          ...interview,
          version: 2,
          status: "RESCHEDULE_REQUIRED",
          interviewer: "Refreshed interviewer",
          preparationNotes: "Refreshed preparation",
        }]}
        initialDate="2026-09-03T09:00:00.000Z"
      />,
    ));

    const details = container.querySelector('[aria-label="Interview details"]');
    expect(details?.textContent).toContain("Refreshed interviewer");
    expect(details?.textContent).toContain("Refreshed preparation");
    expect(details?.textContent).toContain("RESCHEDULE REQUIRED");
    expect(details?.textContent).not.toContain("Jordan Lee");
  });

  it("closes open event details when refreshed props remove the interview", async () => {
    await act(async () => root.render(<CalendarWorkspace actor={actor} interviews={[interview]} initialDate="2026-09-03T09:00:00.000Z" />));
    await act(async () => (container.querySelector('[data-testid="calendar-event"]') as HTMLButtonElement).click());
    expect(container.querySelector('[aria-label="Interview details"]')).not.toBeNull();

    await act(async () => root.render(<CalendarWorkspace actor={actor} interviews={[]} initialDate="2026-09-03T09:00:00.000Z" />));
    expect(container.querySelector('[aria-label="Interview details"]')).toBeNull();

    await act(async () => root.render(<CalendarWorkspace actor={actor} interviews={[interview]} initialDate="2026-09-03T09:00:00.000Z" />));
    expect(container.querySelector('[aria-label="Interview details"]')).toBeNull();
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
    await act(async () => root.render(<CalendarWorkspace actor={{ ...actor, role: "BD" }} interviews={[]} leads={[lead]} closers={[closer]} leadTimezones={{ [lead.id]: "America/New_York" }} />));

    const slot = container.querySelector('[data-testid="calendar-hour-slot"]') as HTMLButtonElement;
    await act(async () => slot.click());

    expect(container.textContent).toContain("Schedule interview");
    expect(container.querySelector('[aria-label="Schedule interview"]')).not.toBeNull();
    expect(container.textContent).toContain("Backend Engineer · Google");
    expect((container.querySelectorAll('input[type="datetime-local"]')[0] as HTMLInputElement).value).toBe("2026-09-04T00:00");
    expect((container.querySelectorAll('input[type="datetime-local"]')[1] as HTMLInputElement).value).toBe("2026-09-04T01:00");
  });

  it("closes the scheduling drawer and refreshes after creating an interview", async () => {
    const lead = { id: "60000000-0000-4000-8000-000000000001", jobTitle: "Backend Engineer", companyName: "Google" } as LeadSummary;
    const closer = { id: "00000000-0000-4000-8000-000000000002", displayName: "Noah Patel", role: "CLOSER", isActive: true, email: "noah@example.com", timezone: "Asia/Karachi", lastLoginAt: null } as UserSummary;
    createLeadInterviewMock.mockResolvedValue({});
    await act(async () => root.render(<CalendarWorkspace actor={{ ...actor, role: "BD" }} interviews={[]} leads={[lead]} closers={[closer]} leadTimezones={{ [lead.id]: "America/New_York" }} />));

    await act(async () => (container.querySelector('[data-testid="calendar-hour-slot"]') as HTMLButtonElement).click());
    await act(async () => container.querySelector('[aria-label="Schedule interview"] form')?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));

    expect(createLeadInterviewMock).toHaveBeenCalledOnce();
    expect(container.querySelector('[aria-label="Schedule interview"]')).toBeNull();
    expect(refreshMock).toHaveBeenCalledOnce();
  });

  it("preserves a New York grid-slot instant in Karachi candidate defaults", async () => {
    const lead = { id: "60000000-0000-4000-8000-000000000001", jobTitle: "Backend Engineer", companyName: "Google" } as LeadSummary;
    const closer = { id: "00000000-0000-4000-8000-000000000002", displayName: "Noah Patel", role: "CLOSER", isActive: true, email: "noah@example.com", timezone: "Asia/Karachi", lastLoginAt: null } as UserSummary;
    await act(async () => root.render(<CalendarWorkspace actor={{ ...actor, role: "BD" }} businessTimeZone="America/New_York" interviews={[]} leads={[lead]} closers={[closer]} leadTimezones={{ [lead.id]: "Asia/Karachi" }} />));

    await act(async () => (container.querySelector('[data-testid="calendar-hour-slot"]') as HTMLButtonElement).click());
    const fields = container.querySelectorAll('input[type="datetime-local"]');

    expect((fields[0] as HTMLInputElement).value).toBe("2026-09-04T09:00");
    expect((fields[1] as HTMLInputElement).value).toBe("2026-09-04T10:00");

    await act(async () => container.querySelector('[aria-label="Schedule interview"] form')?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    expect(createLeadInterviewMock).toHaveBeenCalledWith(lead.id, expect.objectContaining({
      startsAt: "2026-09-04T04:00:00.000Z",
      endsAt: "2026-09-04T05:00:00.000Z",
      timezone: "Asia/Karachi",
      originalDatetimeText: "2026-09-04T09:00–2026-09-04T10:00 (Asia/Karachi)",
    }));
  });

  it("derives the spring-forward default end from one canonical elapsed hour", async () => {
    const lead = { id: "60000000-0000-4000-8000-000000000001", jobTitle: "Backend Engineer", companyName: "Google" } as LeadSummary;
    const closer = { id: "00000000-0000-4000-8000-000000000002", displayName: "Noah Patel", role: "CLOSER", isActive: true, email: "noah@example.com", timezone: "America/New_York", lastLoginAt: null } as UserSummary;
    await act(async () => root.render(<CalendarWorkspace actor={{ ...actor, role: "BD" }} businessTimeZone="America/New_York" interviews={[]} leads={[lead]} closers={[closer]} leadTimezones={{ [lead.id]: "America/New_York" }} initialDate="2026-03-08T12:00:00.000Z" />));

    let clickError: unknown;
    try {
      await act(async () => (container.querySelectorAll('[data-testid="calendar-hour-slot"]')[1] as HTMLButtonElement).click());
    } catch (cause) {
      clickError = cause;
    }

    expect(clickError).toBeUndefined();
    const fields = container.querySelectorAll('input[type="datetime-local"]');
    expect((fields[0] as HTMLInputElement).value).toBe("2026-03-08T01:00");
    expect((fields[1] as HTMLInputElement).value).toBe("2026-03-08T03:00");

    await act(async () => container.querySelector('[aria-label="Schedule interview"] form')?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    expect(createLeadInterviewMock).toHaveBeenCalledWith(lead.id, expect.objectContaining({
      startsAt: "2026-03-08T06:00:00.000Z",
      endsAt: "2026-03-08T07:00:00.000Z",
      timezone: "America/New_York",
      originalDatetimeText: "2026-03-08T01:00–2026-03-08T03:00 (America/New_York)",
    }));
  });

  it("submits untouched fall-back defaults as their selected canonical instants", async () => {
    const lead = { id: "60000000-0000-4000-8000-000000000001", jobTitle: "Backend Engineer", companyName: "Google" } as LeadSummary;
    const closer = { id: "00000000-0000-4000-8000-000000000002", displayName: "Noah Patel", role: "CLOSER", isActive: true, email: "noah@example.com", timezone: "America/New_York", lastLoginAt: null } as UserSummary;
    await act(async () => root.render(<CalendarWorkspace actor={{ ...actor, role: "BD" }} businessTimeZone="UTC" interviews={[]} leads={[lead]} closers={[closer]} leadTimezones={{ [lead.id]: "America/New_York" }} initialDate="2026-11-01T12:00:00.000Z" />));

    await act(async () => (container.querySelectorAll('[data-testid="calendar-hour-slot"]')[5] as HTMLButtonElement).click());
    const fields = container.querySelectorAll('input[type="datetime-local"]');
    expect((fields[0] as HTMLInputElement).value).toBe("2026-11-01T01:00");
    expect((fields[1] as HTMLInputElement).value).toBe("2026-11-01T01:00");

    await act(async () => container.querySelector('[aria-label="Schedule interview"] form')?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    expect(createLeadInterviewMock).toHaveBeenCalledWith(lead.id, expect.objectContaining({
      startsAt: "2026-11-01T05:00:00.000Z",
      endsAt: "2026-11-01T06:00:00.000Z",
      timezone: "America/New_York",
      originalDatetimeText: "2026-11-01T01:00–2026-11-01T01:00 (America/New_York)",
    }));
  });

  it("rejects an edited ambiguous candidate-local time while retaining the fields", async () => {
    const lead = { id: "60000000-0000-4000-8000-000000000001", jobTitle: "Backend Engineer", companyName: "Google" } as LeadSummary;
    const closer = { id: "00000000-0000-4000-8000-000000000002", displayName: "Noah Patel", role: "CLOSER", isActive: true, email: "noah@example.com", timezone: "America/New_York", lastLoginAt: null } as UserSummary;
    await act(async () => root.render(<CalendarWorkspace actor={{ ...actor, role: "BD" }} businessTimeZone="UTC" interviews={[]} leads={[lead]} closers={[closer]} leadTimezones={{ [lead.id]: "America/New_York" }} initialDate="2026-11-01T12:00:00.000Z" />));

    await act(async () => (container.querySelectorAll('[data-testid="calendar-hour-slot"]')[5] as HTMLButtonElement).click());
    const fields = container.querySelectorAll('input[type="datetime-local"]');
    await act(async () => change(fields[0] as HTMLInputElement, "2026-11-01T01:30"));
    await act(async () => container.querySelector('[aria-label="Schedule interview"] form')?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));

    expect(createLeadInterviewMock).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("ambiguous");
    expect((fields[0] as HTMLInputElement).value).toBe("2026-11-01T01:30");
    expect((fields[1] as HTMLInputElement).value).toBe("2026-11-01T01:00");
  });

  it("surfaces an ambiguous display-grid slot without opening the drawer", async () => {
    const lead = { id: "60000000-0000-4000-8000-000000000001", jobTitle: "Backend Engineer", companyName: "Google" } as LeadSummary;
    const closer = { id: "00000000-0000-4000-8000-000000000002", displayName: "Noah Patel", role: "CLOSER", isActive: true, email: "noah@example.com", timezone: "Asia/Karachi", lastLoginAt: null } as UserSummary;
    await act(async () => root.render(<CalendarWorkspace actor={{ ...actor, role: "BD" }} businessTimeZone="America/New_York" interviews={[]} leads={[lead]} closers={[closer]} leadTimezones={{ [lead.id]: "Asia/Karachi" }} initialDate="2026-11-01T12:00:00.000Z" />));

    let clickError: unknown;
    try {
      await act(async () => (container.querySelectorAll('[data-testid="calendar-hour-slot"]')[1] as HTMLButtonElement).click());
    } catch (cause) {
      clickError = cause;
    }

    expect(clickError).toBeUndefined();
    expect(container.querySelector('[aria-label="Schedule interview"]')).toBeNull();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("ambiguous");
    expect(createLeadInterviewMock).not.toHaveBeenCalled();
  });

  it("surfaces an invalid candidate timezone during drawer initialization", async () => {
    const lead = { id: "60000000-0000-4000-8000-000000000001", jobTitle: "Backend Engineer", companyName: "Google" } as LeadSummary;
    const closer = { id: "00000000-0000-4000-8000-000000000002", displayName: "Noah Patel", role: "CLOSER", isActive: true, email: "noah@example.com", timezone: "Asia/Karachi", lastLoginAt: null } as UserSummary;
    await act(async () => root.render(<CalendarWorkspace actor={{ ...actor, role: "BD" }} businessTimeZone="UTC" interviews={[]} leads={[lead]} closers={[closer]} leadTimezones={{ [lead.id]: "Invalid/Timezone" }} initialDate="2026-09-04T12:00:00.000Z" />));

    let clickError: unknown;
    try {
      await act(async () => (container.querySelector('[data-testid="calendar-hour-slot"]') as HTMLButtonElement).click());
    } catch (cause) {
      clickError = cause;
    }

    expect(clickError).toBeUndefined();
    expect(container.querySelector('[aria-label="Schedule interview"]')).toBeNull();
    expect(container.querySelector('[role="alert"]')?.textContent).toBe("Enter a valid IANA timezone.");
  });

  it("blocks scheduling when the selected lead has no profile timezone", async () => {
    const lead = { id: "60000000-0000-4000-8000-000000000001", jobTitle: "Backend Engineer", companyName: "Google" } as LeadSummary;
    const closer = { id: "00000000-0000-4000-8000-000000000002", displayName: "Noah Patel", role: "CLOSER", isActive: true, email: "noah@example.com", timezone: "Asia/Karachi", lastLoginAt: null } as UserSummary;
    await act(async () => root.render(<CalendarWorkspace actor={{ ...actor, role: "BD" }} businessTimeZone="America/New_York" interviews={[]} leads={[lead]} closers={[closer]} />));

    await act(async () => (container.querySelector('[data-testid="calendar-hour-slot"]') as HTMLButtonElement).click());

    expect(container.querySelector('[role="alert"]')?.textContent).toBe("Candidate timezone is unavailable for this application.");
    expect((container.querySelector('[aria-label="Schedule interview"] button[type="submit"]') as HTMLButtonElement).disabled).toBe(true);
    expect(container.textContent).not.toContain("Timezone: America/New_York");
  });

  it("recomputes grid-slot defaults when a different candidate is selected", async () => {
    const newYorkLead = { id: "60000000-0000-4000-8000-000000000001", jobTitle: "Backend Engineer", companyName: "Google" } as LeadSummary;
    const karachiLead = { ...newYorkLead, id: "60000000-0000-4000-8000-000000000002", jobTitle: "Data Engineer" } as LeadSummary;
    const closer = { id: "00000000-0000-4000-8000-000000000002", displayName: "Noah Patel", role: "CLOSER", isActive: true, email: "noah@example.com", timezone: "Asia/Karachi", lastLoginAt: null } as UserSummary;
    await act(async () => root.render(<CalendarWorkspace actor={{ ...actor, role: "BD" }} businessTimeZone="America/New_York" interviews={[]} leads={[newYorkLead, karachiLead]} closers={[closer]} leadTimezones={{ [newYorkLead.id]: "America/New_York", [karachiLead.id]: "Asia/Karachi" }} />));

    await act(async () => (container.querySelector('[data-testid="calendar-hour-slot"]') as HTMLButtonElement).click());
    await act(async () => select(container.querySelector('[aria-label="Schedule interview"] select') as HTMLSelectElement, karachiLead.id));
    const fields = container.querySelectorAll('input[type="datetime-local"]');

    expect((fields[0] as HTMLInputElement).value).toBe("2026-09-04T09:00");
    expect((fields[1] as HTMLInputElement).value).toBe("2026-09-04T10:00");
    expect(container.textContent).toContain("Timezone: Asia/Karachi");
  });

  it("surfaces candidate-timezone conversion errors during application selection", async () => {
    const validLead = { id: "60000000-0000-4000-8000-000000000001", jobTitle: "Backend Engineer", companyName: "Google" } as LeadSummary;
    const invalidLead = { ...validLead, id: "60000000-0000-4000-8000-000000000002", jobTitle: "Data Engineer" } as LeadSummary;
    const closer = { id: "00000000-0000-4000-8000-000000000002", displayName: "Noah Patel", role: "CLOSER", isActive: true, email: "noah@example.com", timezone: "Asia/Karachi", lastLoginAt: null } as UserSummary;
    await act(async () => root.render(<CalendarWorkspace actor={{ ...actor, role: "BD" }} businessTimeZone="UTC" interviews={[]} leads={[validLead, invalidLead]} closers={[closer]} leadTimezones={{ [validLead.id]: "America/New_York", [invalidLead.id]: "Invalid/Timezone" }} initialDate="2026-09-04T12:00:00.000Z" />));

    await act(async () => (container.querySelector('[data-testid="calendar-hour-slot"]') as HTMLButtonElement).click());
    const fields = container.querySelectorAll('input[type="datetime-local"]');
    const startsAt = (fields[0] as HTMLInputElement).value;
    const endsAt = (fields[1] as HTMLInputElement).value;
    let selectionError: unknown;
    try {
      await act(async () => select(container.querySelector('[aria-label="Schedule interview"] select') as HTMLSelectElement, invalidLead.id));
    } catch (cause) {
      selectionError = cause;
    }

    expect(selectionError).toBeUndefined();
    expect(container.querySelector('[role="alert"]')?.textContent).toBe("Enter a valid IANA timezone.");
    expect((container.querySelector('[aria-label="Schedule interview"] button[type="submit"]') as HTMLButtonElement).disabled).toBe(true);
    expect((fields[0] as HTMLInputElement).value).toBe(startsAt);
    expect((fields[1] as HTMLInputElement).value).toBe(endsAt);
    expect(createLeadInterviewMock).not.toHaveBeenCalled();
  });

  it("schedules a selected lead in that candidate's timezone", async () => {
    const lead = { id: "60000000-0000-4000-8000-000000000001", jobTitle: "Backend Engineer", companyName: "Google" } as LeadSummary;
    const closer = { id: "00000000-0000-4000-8000-000000000002", displayName: "Noah Patel", role: "CLOSER", isActive: true, email: "noah@example.com", timezone: "Asia/Karachi", lastLoginAt: null } as UserSummary;
    await act(async () => root.render(<CalendarWorkspace actor={{ ...actor, role: "BD" }} interviews={[]} leads={[lead]} closers={[closer]} leadTimezones={{ [lead.id]: "America/New_York" }} />));

    await act(async () => (container.querySelector('[data-testid="calendar-hour-slot"]') as HTMLButtonElement).click());
    const fields = container.querySelectorAll('input[type="datetime-local"]');
    await act(async () => {
      change(fields[0] as HTMLInputElement, "2026-09-08T10:00");
      change(fields[1] as HTMLInputElement, "2026-09-08T11:00");
    });
    await act(async () => container.querySelector('[aria-label="Schedule interview"] form')?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));

    expect(createLeadInterviewMock).toHaveBeenCalledWith(lead.id, expect.objectContaining({
      startsAt: "2026-09-08T14:00:00.000Z",
      endsAt: "2026-09-08T15:00:00.000Z",
      timezone: "America/New_York",
    }));
  });

  it("rejects a calendar interview that ends before it starts", async () => {
    const lead = { id: "60000000-0000-4000-8000-000000000001", jobTitle: "Backend Engineer", companyName: "Google" } as LeadSummary;
    const closer = { id: "00000000-0000-4000-8000-000000000002", displayName: "Noah Patel", role: "CLOSER", isActive: true, email: "noah@example.com", timezone: "Asia/Karachi", lastLoginAt: null } as UserSummary;
    await act(async () => root.render(<CalendarWorkspace actor={{ ...actor, role: "BD" }} interviews={[]} leads={[lead]} closers={[closer]} leadTimezones={{ [lead.id]: "America/New_York" }} />));

    await act(async () => (container.querySelector('[data-testid="calendar-hour-slot"]') as HTMLButtonElement).click());
    const fields = container.querySelectorAll('input[type="datetime-local"]');
    await act(async () => {
      change(fields[0] as HTMLInputElement, "2026-09-08T11:00");
      change(fields[1] as HTMLInputElement, "2026-09-08T10:00");
    });
    await act(async () => container.querySelector('[aria-label="Schedule interview"] form')?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));

    expect(createLeadInterviewMock).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toBe("End time must be after the start time.");
    expect((fields[0] as HTMLInputElement).value).toBe("2026-09-08T11:00");
    expect((fields[1] as HTMLInputElement).value).toBe("2026-09-08T10:00");
  });

  it("makes interview events draggable and exposes drop targets", async () => {
    await act(async () => root.render(<CalendarWorkspace actor={actor} interviews={[interview]} initialDate="2026-09-03T09:00:00.000Z" />));
    expect(container.querySelector('[data-testid="calendar-event"]')?.getAttribute("draggable")).toBe("true");
    expect(container.querySelector('[data-testid="calendar-hour-slot"]')).not.toBeNull();
  });

  it("preserves a New York drop instant while keeping Karachi event metadata", async () => {
    const lead = { id: interview.leadId, jobTitle: "Backend Engineer", companyName: "Google" } as LeadSummary;
    const closer = { id: "00000000-0000-4000-8000-000000000002", displayName: "Noah Patel", role: "CLOSER", isActive: true, email: "noah@example.com", timezone: "Asia/Karachi", lastLoginAt: null } as UserSummary;
    updateInterviewMock.mockReturnValue(new Promise(() => undefined));
    await act(async () => root.render(<CalendarWorkspace actor={{ ...actor, role: "BD" }} businessTimeZone="America/New_York" interviews={[interview]} leads={[lead]} closers={[closer]} leadTimezones={{ [lead.id]: "Asia/Karachi" }} initialDate="2026-09-03T09:00:00.000Z" />));

    const drop = new Event("drop", { bubbles: true, cancelable: true });
    Object.defineProperties(drop, {
      clientY: { value: 10 * 64 },
      dataTransfer: { value: { getData: () => interview.id } },
    });
    await act(async () => (container.querySelector('[data-testid="calendar-day-column"]') as HTMLElement).dispatchEvent(drop));

    expect(updateInterviewMock).toHaveBeenCalledWith(interview.id, {
      startsAt: "2026-09-03T14:00:00.000Z",
      endsAt: "2026-09-03T14:45:00.000Z",
      timezone: "Asia/Karachi",
      originalDatetimeText: "2026-09-03T19:00–2026-09-03T19:45 (Asia/Karachi)",
      expectedVersion: interview.version,
    });
  });

  it("refreshes the current route after a successful drag reschedule", async () => {
    const lead = { id: interview.leadId, jobTitle: "Backend Engineer", companyName: "Google" } as LeadSummary;
    const closer = { id: interview.closerId, displayName: "Noah Patel", role: "CLOSER", isActive: true, email: "noah@example.com", timezone: "Asia/Karachi", lastLoginAt: null } as UserSummary;
    updateInterviewMock.mockResolvedValue({ ...interview, version: 2 });
    await act(async () => root.render(<CalendarWorkspace actor={{ ...actor, role: "BD" }} businessTimeZone="America/New_York" interviews={[interview]} leads={[lead]} closers={[closer]} leadTimezones={{ [lead.id]: "Asia/Karachi" }} initialDate="2026-09-03T09:00:00.000Z" />));

    await act(async () => dropInterview(container.querySelector('[data-testid="calendar-day-column"]') as HTMLElement, interview.id, 10));

    expect(updateInterviewMock).toHaveBeenCalledOnce();
    expect(refreshMock).toHaveBeenCalledOnce();
  });

  it("surfaces an ambiguous fall-back drop without mutating the interview", async () => {
    const fallBackInterview = {
      ...interview,
      startsAt: "2026-11-01T04:30:00.000Z",
      endsAt: "2026-11-01T05:15:00.000Z",
      timezone: "Asia/Karachi",
    };
    const lead = { id: fallBackInterview.leadId, jobTitle: "Backend Engineer", companyName: "Google" } as LeadSummary;
    const closer = { id: "00000000-0000-4000-8000-000000000002", displayName: "Noah Patel", role: "CLOSER", isActive: true, email: "noah@example.com", timezone: "Asia/Karachi", lastLoginAt: null } as UserSummary;
    await act(async () => root.render(<CalendarWorkspace actor={{ ...actor, role: "BD" }} businessTimeZone="America/New_York" interviews={[fallBackInterview]} leads={[lead]} closers={[closer]} leadTimezones={{ [lead.id]: "Asia/Karachi" }} initialDate="2026-11-01T12:00:00.000Z" />));

    await act(async () => dropInterview(container.querySelector('[data-testid="calendar-day-column"]') as HTMLElement, fallBackInterview.id, 1));

    expect(updateInterviewMock).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("ambiguous");
  });

  it("surfaces a nonexistent spring-forward drop without mutating the interview", async () => {
    const springInterview = {
      ...interview,
      startsAt: "2026-03-08T06:30:00.000Z",
      endsAt: "2026-03-08T07:15:00.000Z",
      timezone: "America/New_York",
    };
    const lead = { id: springInterview.leadId, jobTitle: "Backend Engineer", companyName: "Google" } as LeadSummary;
    const closer = { id: "00000000-0000-4000-8000-000000000002", displayName: "Noah Patel", role: "CLOSER", isActive: true, email: "noah@example.com", timezone: "America/New_York", lastLoginAt: null } as UserSummary;
    await act(async () => root.render(<CalendarWorkspace actor={{ ...actor, role: "BD" }} businessTimeZone="America/New_York" interviews={[springInterview]} leads={[lead]} closers={[closer]} leadTimezones={{ [lead.id]: "America/New_York" }} initialDate="2026-03-08T12:00:00.000Z" />));

    await act(async () => dropInterview(container.querySelector('[data-testid="calendar-day-column"]') as HTMLElement, springInterview.id, 2));

    expect(updateInterviewMock).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("does not exist");
  });

  it("preserves spring-forward duration and event-timezone metadata when dragging", async () => {
    const springInterview = {
      ...interview,
      startsAt: "2026-03-08T06:30:00.000Z",
      endsAt: "2026-03-08T07:30:00.000Z",
      timezone: "America/New_York",
    };
    const lead = { id: springInterview.leadId, jobTitle: "Backend Engineer", companyName: "Google" } as LeadSummary;
    const closer = { id: "00000000-0000-4000-8000-000000000002", displayName: "Noah Patel", role: "CLOSER", isActive: true, email: "noah@example.com", timezone: "America/New_York", lastLoginAt: null } as UserSummary;
    updateInterviewMock.mockReturnValue(new Promise(() => undefined));
    await act(async () => root.render(<CalendarWorkspace actor={{ ...actor, role: "BD" }} businessTimeZone="America/New_York" interviews={[springInterview]} leads={[lead]} closers={[closer]} leadTimezones={{ [lead.id]: "America/New_York" }} initialDate="2026-03-08T12:00:00.000Z" />));

    await act(async () => dropInterview(container.querySelector('[data-testid="calendar-day-column"]') as HTMLElement, springInterview.id, 3));

    expect(updateInterviewMock).toHaveBeenCalledWith(springInterview.id, {
      startsAt: "2026-03-08T07:00:00.000Z",
      endsAt: "2026-03-08T08:00:00.000Z",
      timezone: "America/New_York",
      originalDatetimeText: "2026-03-08T03:00–2026-03-08T04:00 (America/New_York)",
      expectedVersion: springInterview.version,
    });
  });
});
