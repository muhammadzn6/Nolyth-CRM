type InterviewSignal = { startsAt: string; preparationNotes: string | null };

export type CloserDashboardKpi = {
  key: string;
  label: string;
  value: number;
  href: string;
  definition: string;
  tone: "default" | "info" | "warning" | "danger";
};

export function buildCloserDashboardKpis(input: { todayMeetings: InterviewSignal[]; calendarInterviews: InterviewSignal[]; feedback: number; conflicts: number; openActions: number }, now = new Date()): CloserDashboardKpi[] {
  const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const upcoming = input.calendarInterviews.filter((interview) => {
    const startsAt = new Date(interview.startsAt);
    return startsAt >= now && startsAt <= weekEnd;
  });
  return [
    { key: "today", label: "Interviews today", value: input.todayMeetings.length, href: "/#calendar", definition: "Interviews assigned to you scheduled for today.", tone: "info" },
    { key: "next7Days", label: "Next 7 days", value: upcoming.length, href: "/#calendar", definition: "Upcoming assigned interviews in the next seven days.", tone: "default" },
    { key: "feedback", label: "Feedback pending", value: input.feedback, href: "/#feedback", definition: "Completed interviews waiting for your notes or outcome.", tone: input.feedback ? "warning" : "default" },
    { key: "prep", label: "Preparation missing", value: upcoming.filter((interview) => !interview.preparationNotes).length, href: "/#calendar", definition: "Upcoming interviews without preparation notes.", tone: upcoming.some((interview) => !interview.preparationNotes) ? "warning" : "default" },
    { key: "conflicts", label: "Scheduling conflicts", value: input.conflicts, href: "/#actions", definition: "Assigned interviews marked as needing rescheduling.", tone: input.conflicts ? "danger" : "default" },
    { key: "actions", label: "Open actions", value: input.openActions, href: "/tasks", definition: "Open tasks assigned to you.", tone: input.openActions ? "warning" : "default" },
  ];
}
