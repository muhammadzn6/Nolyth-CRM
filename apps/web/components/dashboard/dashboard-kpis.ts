import type { AnalyticsKpis } from "@orbit/contracts";

export type DashboardKpi = {
  key: string;
  label: string;
  value: number;
  href: string;
  definition: string;
  tone: "default" | "info" | "warning" | "success";
};

export function buildDashboardKpis(kpis: AnalyticsKpis, schedulingConflicts: number): DashboardKpi[] {
  return [
    { key: "applications", label: "Applications", value: kpis.applications, href: "/leads", definition: "Applications recorded in the selected workspace and period.", tone: "default" },
    { key: "responses", label: "Recruiter responses", value: kpis.responses, href: "/leads?status=RESPONSE_RECEIVED", definition: "Applications that have received a recruiter response or moved further in the pipeline.", tone: "info" },
    { key: "interview-leads", label: "Interview leads", value: kpis.interviews, href: "/?calendarView=agenda", definition: "Unique leads with at least one non-cancelled interview round in the selected period.", tone: "info" },
    { key: "interview-rounds", label: "Interview rounds", value: kpis.interviewRounds, href: "/?calendarView=agenda", definition: "All non-cancelled interview rounds in the selected period. Cancelled rounds are excluded.", tone: "info" },
    { key: "overdue", label: "Overdue actions", value: kpis.overdueTasks, href: "/tasks", definition: "Open assigned actions whose due time has passed.", tone: kpis.overdueTasks > 0 ? "warning" : "default" },
    { key: "conflicts", label: "Scheduling conflicts", value: schedulingConflicts, href: "/?calendarView=day", definition: "Interviews currently marked as needing rescheduling.", tone: schedulingConflicts > 0 ? "warning" : "default" },
    { key: "offers", label: "Offer-stage leads", value: kpis.offers, href: "/leads?status=OFFER_RECEIVED", definition: "Unique applications that reached offer received, accepted, placed, or started.", tone: "success" },
    { key: "placements", label: "Placements", value: kpis.placements, href: "/leads?status=PLACED", definition: "Applications currently marked placed or started.", tone: "success" },
  ];
}
