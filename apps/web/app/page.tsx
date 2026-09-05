import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ReactElement } from "react";
import {
  adminBdPerformanceResponseSchema,
  bdPerformanceResponseSchema,
  performanceDrilldownQuerySchema,
  performanceDrilldownResponseSchema,
  performanceFollowUpWithLeadSchema,
  reassignPerformanceFollowUpInputSchema,
  successResponseSchema,
} from "@orbit/contracts";
import { loadWebEnv } from "@orbit/config";

import { CloserDashboard } from "../components/dashboard/closer-dashboard";
import { BdDashboard } from "../components/dashboard/bd-dashboard";
import { DashboardOverview } from "../components/dashboard/dashboard-overview";
import { AppShell } from "../components/layout/app-shell";
import { ScoreDetails } from "../components/performance/score-details";
import {
  ApiClientError,
  getCloserDashboard,
  getCalendar,
  getCurrentActor,
  getDashboard,
  listActivity,
  listLeads,
  listUsers,
  listTasks,
} from "../lib/api-client";
import type { PerformancePeriod } from "../components/performance/bd-team-kpis";

export const dynamic = "force-dynamic";

type ResponseSchema<T> = { safeParse(value: unknown): { success: true; data: T } | { success: false } };
type PageSearchParams = Promise<{ performancePeriod?: string | string[]; performanceMetric?: string | string[]; performanceBdId?: string | string[] }>;
type HomePageProps = { searchParams: PageSearchParams };

function selectedPeriod(value: string | string[] | undefined): PerformancePeriod {
  return value === "day" || value === "7d" || value === "30d" ? value : "30d";
}

function performanceRange(period: PerformancePeriod) {
  const to = new Date();
  if (period === "day") {
    const from = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()));
    return { from: from.toISOString(), to: to.toISOString() };
  }
  const days = period === "7d" ? 7 : 30;
  return { from: new Date(to.getTime() - days * 24 * 60 * 60 * 1000).toISOString(), to: to.toISOString() };
}

function apiUrl(path: string): string {
  return `${loadWebEnv({ NEXT_PUBLIC_APP_BASE_URL: process.env.NEXT_PUBLIC_APP_BASE_URL, NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL }).apiBaseUrl}${path}`;
}

async function readPerformance<T>(path: string, schema: ResponseSchema<T>, cookie?: string): Promise<T> {
  const response = await fetch(apiUrl(path), { cache: "no-store", headers: cookie ? { cookie } : undefined });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new ApiClientError("Performance data is temporarily unavailable.", "PERFORMANCE_UNAVAILABLE", undefined, response.status);
  const envelope = successResponseSchema.safeParse(body);
  if (!envelope.success) throw new ApiClientError("The API returned invalid performance data.", "INVALID_RESPONSE", undefined, response.status);
  const parsed = schema.safeParse(envelope.data.data);
  if (!parsed.success) throw new ApiClientError("The API returned invalid performance data.", "INVALID_RESPONSE", undefined, response.status);
  return parsed.data;
}

async function submitPerformanceReassignment(formData: FormData) {
  "use server";
  const parsed = reassignPerformanceFollowUpInputSchema.safeParse({
    newOwnerId: formData.get("newOwnerId"),
    expectedVersion: Number(formData.get("expectedVersion")),
  });
  const followUpId = String(formData.get("followUpId") ?? "");
  if (!parsed.success || !followUpId) throw new ApiClientError("Choose a valid BD owner.", "VALIDATION_ERROR");
  const cookie = (await headers()).get("cookie") ?? undefined;
  const response = await fetch(apiUrl(`/performance/follow-ups/${followUpId}/reassign`), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: loadWebEnv({ NEXT_PUBLIC_APP_BASE_URL: process.env.NEXT_PUBLIC_APP_BASE_URL, NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL }).appBaseUrl,
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(parsed.data),
  });
  const body: unknown = await response.json().catch(() => null);
  const envelope = successResponseSchema.safeParse(body);
  if (!response.ok || !envelope.success || !performanceFollowUpWithLeadSchema.safeParse(envelope.data.data).success) {
    throw new ApiClientError("Orbit could not reassign this follow-up.", "PERFORMANCE_REASSIGNMENT_FAILED", undefined, response.status);
  }
  revalidatePath("/");
}

export default function HomePage(): Promise<ReactElement>;
export default function HomePage(props: HomePageProps): Promise<ReactElement>;
export default async function HomePage(props?: HomePageProps) {
  const query = await props?.searchParams ?? {};
  const performancePeriod = selectedPeriod(Array.isArray(query.performancePeriod) ? query.performancePeriod[0] : query.performancePeriod);
  const range = performanceRange(performancePeriod);
  const metric = Array.isArray(query.performanceMetric) ? query.performanceMetric[0] : query.performanceMetric;
  const bdId = Array.isArray(query.performanceBdId) ? query.performanceBdId[0] : query.performanceBdId;
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
    let applications;
    let openTasks;
    let users;
    if (actor.role === "ADMIN" || actor.role === "BD") {
      try { [applications, openTasks, users] = await Promise.all([listLeads({ limit: 100 }, cookie), actor.role === "BD" ? listTasks({ status: "OPEN" }, cookie) : Promise.resolve(undefined), listUsers(cookie)]); } catch { applications = undefined; openTasks = undefined; users = undefined; }
    }
    let adminPerformance;
    let performanceReassignments;
    let performanceDrilldown;
    let bdPerformanceDrilldown;
    let bdPerformance;
    let bdTodayPerformance;
    let performanceReassignmentError: string | undefined;
    if (actor.role === "ADMIN") {
      try {
        adminPerformance = await readPerformance(`/performance/admin?${new URLSearchParams(range)}`, adminBdPerformanceResponseSchema, cookie);
        const drilldown = performanceDrilldownQuerySchema.safeParse({ ...range, metric, ...(bdId ? { bdId } : {}) });
        if (drilldown.success) {
          try {
            performanceDrilldown = await readPerformance(`/performance/admin/drilldown?${new URLSearchParams(Object.entries(drilldown.data).reduce<Record<string, string>>((values, [key, value]) => ({ ...values, [key]: String(value) }), {}))}`, performanceDrilldownResponseSchema, cookie);
          } catch {
            performanceDrilldown = undefined;
          }
        }
      } catch {
        adminPerformance = undefined;
      }
      if (adminPerformance) {
        try {
          performanceReassignments = await readPerformance("/performance/admin/reassignment-queue", performanceFollowUpWithLeadSchema.array(), cookie);
        } catch {
          performanceReassignments = [];
          performanceReassignmentError = "Reassignment queue is temporarily unavailable. Refresh to try again.";
        }
      }
    }
    if (actor.role === "BD") {
      try {
        [bdPerformance, bdTodayPerformance] = await Promise.all([
          readPerformance(`/performance/me?${new URLSearchParams(range)}`, bdPerformanceResponseSchema, cookie),
          readPerformance(`/performance/me?${new URLSearchParams(performanceRange("day"))}`, bdPerformanceResponseSchema, cookie),
        ]);
        const drilldown = performanceDrilldownQuerySchema.safeParse({ ...range, metric });
        if (drilldown.success) {
          try {
            bdPerformanceDrilldown = await readPerformance(`/performance/me/drilldown?${new URLSearchParams(Object.entries(drilldown.data).reduce<Record<string, string>>((values, [key, value]) => ({ ...values, [key]: String(value) }), {}))}`, performanceDrilldownResponseSchema, cookie);
          } catch {
            bdPerformanceDrilldown = undefined;
          }
        }
      } catch {
        bdPerformance = undefined;
        bdTodayPerformance = undefined;
      }
    }
    if (actor.role === "BD" && bdPerformance) return <AppShell actor={actor}><BdDashboard actor={actor} applications={applications?.items ?? []} openTasks={openTasks ?? []} interviews={calendar ?? []} performance={bdPerformance} todayPerformance={bdTodayPerformance} />{bdPerformanceDrilldown && metric ? <div className="editorial-dashboard mx-auto mt-5 max-w-[1500px]"><ScoreDetails items={bdPerformanceDrilldown} metric={metric} scope="personal" /></div> : null}</AppShell>;
    return <AppShell actor={actor}><DashboardOverview actor={actor} dashboard={dashboard} recentActivity={recentActivity} calendarInterviews={calendar} applications={applications?.items} openTasks={openTasks} adminPerformance={adminPerformance} performancePeriod={performancePeriod} performanceMetric={metric} performanceDrilldown={performanceDrilldown} performanceReassignments={performanceReassignments} performanceReassignmentError={performanceReassignmentError} performanceOwners={users?.filter((user) => user.role === "BD" && user.isActive)} onPerformanceReassign={submitPerformanceReassignment} /></AppShell>;
  } catch (reason) {
    return <AppShell actor={actor}><DashboardOverview actor={actor} error={reason instanceof ApiClientError ? reason.message : "Live dashboard data is temporarily unavailable."} /></AppShell>;
  }
}
