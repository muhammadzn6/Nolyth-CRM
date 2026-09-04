import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { CloserDashboard } from "../components/dashboard/closer-dashboard";
import { DashboardOverview } from "../components/dashboard/dashboard-overview";
import { AppShell } from "../components/layout/app-shell";
import {
  ApiClientError,
  getCloserDashboard,
  getCalendar,
  getCurrentActor,
  getDashboard,
  listActivity,
  listTasks,
} from "../lib/api-client";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const cookie = (await headers()).get("cookie") ?? undefined;
  const actor = await getCurrentActor(cookie);
  if (!actor) redirect("/login");

  if (actor.role === "CLOSER") {
    try {
      const dashboard = await getCloserDashboard(cookie);
      let calendar;
      try { calendar = await getCalendar({}, cookie); } catch { calendar = undefined; }
      return <AppShell actor={actor}><CloserDashboard actor={actor} data={dashboard} calendarInterviews={calendar} /></AppShell>;
    } catch (reason) {
      return <AppShell actor={actor}><CloserDashboard actor={actor} error={reason instanceof ApiClientError ? reason.message : "Your closer dashboard is temporarily unavailable."} /></AppShell>;
    }
  }

  try {
    const dashboard = await getDashboard(cookie);
    let recentActivity;
    try { recentActivity = await listActivity({ limit: 4 }, cookie); } catch { recentActivity = undefined; }
    let calendar;
    try { calendar = await getCalendar({}, cookie); } catch { calendar = undefined; }
    let openTasks: Awaited<ReturnType<typeof listTasks>> = [];
    try { openTasks = await listTasks({ status: "OPEN", limit: 4 }, cookie); } catch { openTasks = []; }
    return <AppShell actor={actor}><DashboardOverview actor={actor} dashboard={dashboard} recentActivity={recentActivity} calendarInterviews={calendar} openTasks={openTasks} /></AppShell>;
  } catch (reason) {
    return <AppShell actor={actor}><DashboardOverview actor={actor} error={reason instanceof ApiClientError ? reason.message : "Live dashboard data is temporarily unavailable."} /></AppShell>;
  }
}
