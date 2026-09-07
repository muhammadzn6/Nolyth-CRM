// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { CloserDashboardData, SessionUser } from "@orbit/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CloserDashboard } from "./closer-dashboard";

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

  async function renderDashboard(data?: CloserDashboardData, error?: string) {
    await act(async () => {
      root.render(<CloserDashboard actor={actor} data={data} error={error} />);
    });
  }

  it("prioritizes today’s agenda with a next-meeting briefing and feedback queue", async () => {
    await renderDashboard(dashboard);

    const calendar = container.querySelector('[aria-label="Primary calendar"]');
    const summary = container.querySelector('[aria-label="Closer summary"]');
    expect(calendar).not.toBeNull();
    expect(summary).not.toBeNull();
    expect(Boolean(calendar && calendar.compareDocumentPosition(summary!) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    const dayButton = Array.from(calendar?.querySelectorAll("button") ?? []).find((button) => button.textContent === "D");
    expect(dayButton?.getAttribute("aria-pressed")).toBe("true");
    const weekButton = Array.from(calendar?.querySelectorAll("button") ?? []).find((button) => button.textContent === "W");
    await act(async () => weekButton?.click());
    expect(container.querySelector('[data-testid="calendar-event"]')?.textContent).toContain("TECHNICAL");
    expect(container.textContent).toContain("Next meeting briefing");
    expect(container.textContent).toContain("Jordan Patel");
    expect(container.textContent).toContain("Review system design experience.");
    expect(container.textContent).toContain("Ada Lovelace");
    expect(container.textContent).toContain("Platform Engineering");
    expect(container.textContent).toContain("Staff Platform Engineer at Northstar Labs");
    expect(container.textContent).toContain("Feedback to record");
    expect(container.textContent).toContain("Final · Round 3");
    expect(container.textContent).toContain("Assigned applications");
    expect(container.textContent).toContain("Eyong");
    expect(container.textContent).toContain("Backend Engineer at Google");
    expect(container.textContent).toContain("Feedback due");
    expect(container.textContent).toContain("Today");
    expect(container.querySelector(".editorial-surface-feature")).not.toBeNull();
    expect(container.querySelector(".editorial-surface-grid")).not.toBeNull();
    expect(container.querySelector(".editorial-surface-alert")).not.toBeNull();
    expect(container.querySelector(".editorial-surface-lines")).not.toBeNull();
    expect(container.querySelector(".editorial-surface-soft")).not.toBeNull();
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

    expect(container.textContent).toContain("Google Calendar");
    expect(container.textContent).toContain("Not connected");
    expect(container.textContent).not.toContain("Orbit interviews in view");
    expect(container.textContent).toContain("No feedback is waiting");
    expect(container.textContent).toContain("No open tasks");
  });

  it("makes dashboard timestamps explicit in the closer timezone", async () => {
    await renderDashboard({
      ...dashboard,
      calendarConnection: {
        ...dashboard.calendarConnection,
        lastSyncedAt: "2026-09-03T08:30:00.000Z",
      },
    });

    expect(container.textContent).toContain("Asia/Karachi");
  });

  it("links the dashboard to the full calendar workspace", async () => {
    await renderDashboard(dashboard);

    expect(container.textContent).toContain("Agenda");
    expect(container.textContent).not.toContain("Scheduling workspace");
  });

  it("places the all-time placement funnel after the operational updates", async () => {
    await renderDashboard(dashboard);

    const notificationsLink = container.querySelector('a[href="/notifications"]');
    const funnel = container.querySelector('[aria-label="Closer lifetime placement funnel"]');

    expect(funnel).not.toBeNull();
    expect(Boolean(notificationsLink && notificationsLink.compareDocumentPosition(funnel!) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
  });
});
