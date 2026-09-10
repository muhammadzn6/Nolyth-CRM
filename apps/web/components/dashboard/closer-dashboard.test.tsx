// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { CloserDashboardData, InterviewSummary, SessionUser } from "@orbit/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CloserDashboard } from "./closer-dashboard";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const actor: SessionUser = {
  id: "00000000-0000-4000-8000-000000000003",
  displayName: "Nadia Reed",
  email: "nadia@orbit.example",
  role: "CLOSER",
  isActive: true,
};

const nextMeeting = {
  id: "50000000-0000-4000-8000-000000000001",
  leadId: "60000000-0000-4000-8000-000000000001",
  roundNumber: 2,
  roundType: "TECHNICAL" as const,
  status: "SCHEDULED" as const,
  closerId: actor.id,
  creatorId: "00000000-0000-4000-8000-000000000001",
  startsAt: "2026-09-03T09:30:00.000Z",
  endsAt: "2026-09-03T10:15:00.000Z",
  timezone: "Asia/Karachi",
  originalDatetimeText: "Today at 2:30 PM",
  interviewer: "Jordan Patel",
  meetingLink: "https://meet.example.com/orbit-1",
  location: null,
  preparationNotes: "Review system design experience.",
  closerNotes: null,
  officialFeedback: null,
  officialResult: null,
  attendance: null,
  googleSyncStatus: null,
  version: 1,
  createdAt: "2026-09-02T08:00:00.000Z",
  updatedAt: "2026-09-02T08:00:00.000Z",
  candidateName: "Ada Lovelace",
  profileName: "Platform Engineering",
  jobTitle: "Staff Platform Engineer",
  companyName: "Northstar Labs",
};

const feedbackMeeting = {
  ...nextMeeting,
  id: "50000000-0000-4000-8000-000000000002",
  status: "WAITING_FEEDBACK" as const,
  roundNumber: 3,
  roundType: "FINAL" as const,
  startsAt: "2026-09-02T10:00:00.000Z",
  endsAt: "2026-09-02T10:45:00.000Z",
  originalDatetimeText: "Yesterday at 3:00 PM",
};

const dashboard: CloserDashboardData = {
  timezone: "Asia/Karachi",
  assignedApplications: [
    {
      id: nextMeeting.leadId,
      profileId: nextMeeting.leadId,
      candidateName: "Eyong",
      profileName: "Backend Engineering",
      jobTitle: "Backend Engineer",
      companyName: "Google",
      status: "INTERVIEWING",
      nextInterviewAt: nextMeeting.startsAt,
    },
  ],
  nextMeeting,
  todayMeetings: [nextMeeting],
  externalMeetings: [],
  needsFeedback: [feedbackMeeting],
  openTasks: [
    {
      id: "70000000-0000-4000-8000-000000000001",
      profileId: "30000000-0000-4000-8000-000000000001",
      leadId: nextMeeting.leadId,
      assigneeId: actor.id,
      creatorId: "00000000-0000-4000-8000-000000000001",
      type: "PREPARE_INTERVIEW",
      title: "Prepare technical interview notes",
      description: null,
      priority: "HIGH",
      status: "OPEN",
      dueAt: "2026-09-03T08:00:00.000Z",
      completedAt: null,
      completedNotes: null,
      createdAt: "2026-09-02T08:00:00.000Z",
      updatedAt: "2026-09-02T08:00:00.000Z",
      version: 1,
    },
  ],
  conflicts: [],
  notifications: [
    {
      id: "80000000-0000-4000-8000-000000000001",
      recipientId: actor.id,
      type: "INTERVIEW_REMINDER",
      title: "Interview reminder",
      message: "Your technical interview starts in 30 minutes.",
      relatedEntityType: "INTERVIEW",
      relatedEntityId: nextMeeting.id,
      createdAt: "2026-09-03T09:00:00.000Z",
      readAt: null,
    },
  ],
  recentActivity: [
    {
      id: "90000000-0000-4000-8000-000000000001",
      actorId: actor.id,
      actorNameSnapshot: "Nadia Reed",
      actorRoleSnapshot: "CLOSER",
      entityType: "INTERVIEW",
      entityId: nextMeeting.id,
      action: "INTERVIEW_SCHEDULED",
      profileId: "30000000-0000-4000-8000-000000000001",
      leadId: nextMeeting.leadId,
      metadata: null,
      occurredAt: "2026-09-03T08:30:00.000Z",
    },
  ],
  lifetimeFunnel: {
    applicationsHandled: 48,
    interviewsScheduled: 22,
    callsAttended: 14,
    interviewRounds: 37,
    attendedRounds: 29,
    cancelledRounds: 3,
    averageRoundsPerInterviewLead: 37 / 22,
    roundAttendanceRate: 29 / 37,
    offers: 6,
    placements: 2,
  },
  calendarConnection: {
    connected: false,
    email: null,
    calendarName: null,
    lastSyncedAt: null,
    status: "DISCONNECTED",
  },
};

describe("CloserDashboard", () => {
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

  async function renderDashboard(data?: CloserDashboardData, error?: string, calendarInterviews?: InterviewSummary[]) {
    await act(async () => {
      root.render(<CloserDashboard actor={actor} data={data} error={error} calendarInterviews={calendarInterviews} />);
    });
  }

  it("keeps the calendar and decision rail together above the supporting work", async () => {
    await renderDashboard(dashboard);

    expect(container.querySelector('[aria-label="Closer dashboard context"]')).not.toBeNull();
    const workspace = container.querySelector('[aria-label="Closer operational workspace"]');
    const calendar = container.querySelector('[aria-label="Primary calendar"]');
    const controlRail = container.querySelector('[aria-label="Closer control rail"]');
    const summary = container.querySelector('[aria-label="Closer summary"]');
    const briefing = container.querySelector('[aria-label="Next interview briefing"]');
    const attention = container.querySelector('[aria-label="Needs attention"]');

    expect(workspace).not.toBeNull();
    expect(calendar).not.toBeNull();
    expect(controlRail).not.toBeNull();
    expect(summary).not.toBeNull();
    expect(controlRail?.contains(summary)).toBe(true);
    expect(controlRail?.contains(briefing)).toBe(true);
    expect(controlRail?.contains(attention)).toBe(true);
    const dayButton = Array.from(calendar?.querySelectorAll("button") ?? []).find((button) => button.textContent === "D");
    expect(dayButton?.getAttribute("aria-pressed")).toBe("true");
    const weekButton = Array.from(calendar?.querySelectorAll("button") ?? []).find((button) => button.textContent === "W");
    await act(async () => weekButton?.click());
    expect(container.querySelector('[data-testid="calendar-event"]')?.textContent).toContain("TECHNICAL");
    expect(container.textContent).toContain("Next interview");
    expect(container.textContent).toContain("Jordan Patel");
    expect(container.textContent).toContain("Review system design experience.");
    expect(container.textContent).toContain("Ada Lovelace");
    expect(container.textContent).toContain("Platform Engineering");
    expect(container.textContent).toContain("Staff Platform Engineer");
    expect(container.textContent).toContain("Northstar Labs");
    expect(container.textContent).toContain("Needs attention");
    expect(container.textContent).toContain("Final · Round 3");
    expect(container.textContent).toContain("Active interview pipeline");
    expect(container.textContent).toContain("Eyong");
    expect(container.textContent).toContain("Backend Engineer");
    expect(container.textContent).toContain("Google");
    expect(container.textContent).toContain("Feedback due");
    expect(container.textContent).toContain("Rounds today");
    expect(container.textContent).toContain("Rounds · 7 days");
    expect(container.textContent).not.toContain("This week");
    expect(container.textContent).not.toContain("Action queue");
    expect(container.textContent).not.toContain("Feedback to record");
    expect(container.textContent).not.toContain("(month:");
  });

  it("shows the disconnected Google Calendar state and useful empty states", async () => {
    await renderDashboard({
      ...dashboard,
      nextMeeting: null,
      todayMeetings: [],
      externalMeetings: [],
      needsFeedback: [],
      openTasks: [],
      notifications: [],
      recentActivity: [],
    });

    const calendarStatus = container.querySelector('a[href="/settings"]');
    const attention = container.querySelector('[aria-label="Needs attention"]');

    expect(calendarStatus?.textContent).toContain("Not connected");
    expect(container.textContent).not.toContain("Orbit interviews in view");
    expect(attention?.textContent).toContain("You’re clear for now");
  });

  it("counts scheduled interviews across the next seven dashboard calendar days", async () => {
    const calendarInterviews = [
      { ...nextMeeting, id: "50000000-0000-4000-8000-000000000010", startsAt: "2026-09-04T10:00:00.000Z" },
      { ...nextMeeting, id: "50000000-0000-4000-8000-000000000011", startsAt: "2026-09-05T10:00:00.000Z" },
      { ...nextMeeting, id: "50000000-0000-4000-8000-000000000012", startsAt: "2026-09-10T18:00:00.000Z" },
      { ...nextMeeting, id: "50000000-0000-4000-8000-000000000014", startsAt: "2026-09-06T10:00:00.000Z", status: "CANCELLED" as const },
      { ...nextMeeting, id: "50000000-0000-4000-8000-000000000015", startsAt: "2026-09-06T11:00:00.000Z", status: "RESCHEDULE_REQUIRED" as const },
      { ...nextMeeting, id: "50000000-0000-4000-8000-000000000016", startsAt: "2026-09-06T12:00:00.000Z", status: "WAITING_FEEDBACK" as const },
      { ...nextMeeting, id: "50000000-0000-4000-8000-000000000013", startsAt: "2026-09-11T09:00:00.000Z" },
    ];

    await renderDashboard(dashboard, undefined, calendarInterviews);

    expect(container.querySelector('[aria-label="Rounds · 7 days: 3"]')).not.toBeNull();
  });

  it("makes dashboard timestamps explicit in the closer timezone", async () => {
    await renderDashboard({
      ...dashboard,
      calendarConnection: {
        ...dashboard.calendarConnection,
        connected: true,
        status: "CONNECTED",
        calendarName: "Avery interview calendar",
        lastSyncedAt: "2026-09-03T08:30:00.000Z",
      },
    });

    const calendarStatus = container.querySelector('a[href="/settings"]');
    expect(calendarStatus?.textContent).toContain("Synced Sep 3, 1:30 PM");
    expect(calendarStatus?.getAttribute("aria-label")).toContain("Avery interview calendar");
  });

  it("renders the dashboard date in the configured timezone", async () => {
    vi.setSystemTime(new Date("2026-09-04T23:30:00.000Z"));

    await renderDashboard({ ...dashboard, timezone: "America/New_York" });

    expect(container.textContent).toContain("Fri, Sep 4, 2026");
    expect(container.textContent).not.toContain("Sat, Sep 5, 2026");
  });

  it("links the dashboard to the full calendar workspace", async () => {
    await renderDashboard(dashboard);

    expect(container.textContent).toContain("Agenda");
    expect(container.textContent).not.toContain("Scheduling workspace");
  });

  it("consolidates the pipeline and updates before the all-time placement funnel", async () => {
    await renderDashboard(dashboard);

    const pipeline = container.querySelector('[aria-label="Active interview pipeline"]');
    const updates = container.querySelector('[aria-label="Recent updates"]');
    const funnel = container.querySelector('[aria-label="Closer lifetime placement funnel"]');

    expect(pipeline).not.toBeNull();
    expect(updates).not.toBeNull();
    expect(updates?.textContent).toContain("Interview reminder");
    expect(updates?.textContent).toContain("Interview Scheduled");
    const updateViews = updates?.querySelector('[aria-label="Recent update views"]');
    expect(updateViews?.querySelector('a[href="/activity"]')).not.toBeNull();
    expect(updateViews?.querySelector('a[href="/notifications"]')).not.toBeNull();
    expect(funnel).not.toBeNull();
    expect(Boolean(updates && updates.compareDocumentPosition(funnel!) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    expect(Array.from(container.querySelectorAll("h2"), (heading) => heading.textContent)).not.toContain("Notifications");
  });
});
