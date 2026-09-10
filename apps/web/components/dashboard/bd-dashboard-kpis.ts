type ApplicationSignal = { appliedDate: string; status: string; rawUrl: string; companyName?: string };

export type BdDailyPlatformSignal = { platform: string; count: number; tone?: "coral" | "peach" | "amber" | "terracotta" };

export type BdDailyActivitySummary = {
  qualifiedApplications: number;
  recordedApplications: number | null;
  dailyTarget: number | null;
  remaining: number | null;
  uniqueCompanies: number | null;
  uniqueJobs: number | null;
  uniqueRecruiters: number | null;
  duplicates: number | null;
  pendingOverrides: number | null;
  platforms: BdDailyPlatformSignal[];
};

export function buildBdDailyActivitySummary(input: {
  qualifiedApplications: number;
  recordedApplications?: number | null;
  dailyTarget?: number | null;
  uniqueCompanies?: number | null;
  uniqueJobs?: number | null;
  uniqueRecruiters?: number | null;
  duplicates?: number | null;
  pendingOverrides?: number | null;
  platforms?: BdDailyPlatformSignal[];
}): BdDailyActivitySummary {
  const target = input.dailyTarget ?? null;
  return {
    qualifiedApplications: input.qualifiedApplications,
    recordedApplications: input.recordedApplications ?? null,
    dailyTarget: target,
    remaining: target == null ? null : Math.max(0, target - input.qualifiedApplications),
    uniqueCompanies: input.uniqueCompanies ?? null,
    uniqueJobs: input.uniqueJobs ?? null,
    uniqueRecruiters: input.uniqueRecruiters ?? null,
    duplicates: input.duplicates ?? null,
    pendingOverrides: input.pendingOverrides ?? null,
    platforms: input.platforms ?? [],
  };
}

export type BdDashboardKpi = {
  key: string;
  label: string;
  value: number;
  href: string;
  definition: string;
  tone: "default" | "info" | "warning" | "success";
};

export function buildBdSecondarySignals(input: { applications: Array<{ status: string }>; scheduledInterviews: number; interviewsToSchedule: number; averageResponseTimeHours: number | null }) {
  return {
    scheduledInterviews: input.scheduledInterviews,
    interviewsToSchedule: input.interviewsToSchedule,
    offers: input.applications.filter((application) => application.status === "OFFER_RECEIVED").length,
    closed: input.applications.filter((application) => application.status === "CLOSED").length,
    averageResponseTimeHours: input.averageResponseTimeHours,
  };
}

export function buildBdDashboardKpis(input: { applications: ApplicationSignal[]; openFollowUps: number; interviewsToSchedule: number; now?: Date; dailyTarget?: number }): BdDashboardKpi[] {
  const target = input.dailyTarget ?? 70;
  const date = new Intl.DateTimeFormat("en-CA").format(input.now ?? new Date());
  const today = input.applications.filter((application) => application.appliedDate === date).length;
  const seen = new Set<string>();
  const duplicates = input.applications.filter((application) => {
    const key = application.rawUrl.toLowerCase();
    if (seen.has(key)) return true;
    seen.add(key);
    return false;
  }).length;
  const quality = input.applications.filter((application) => !application.companyName || !application.rawUrl).length;
  const responses = input.applications.filter((application) => application.status !== "APPLIED").length;
  const active = input.applications.filter((application) => !["APPLIED", "CLOSED", "STARTED"].includes(application.status)).length;
  return [
    { key: "today", label: "Applications today", value: today, href: "/leads", definition: `Applications entered today against the daily target of ${target}.`, tone: today >= target ? "success" : "info" },
    { key: "remaining", label: "Remaining target", value: Math.max(0, target - today), href: "/leads", definition: `Applications still needed to reach today’s target of ${target}.`, tone: today >= target ? "success" : "warning" },
    { key: "quality", label: "Data quality issues", value: quality, href: "/leads", definition: "Applications missing a required company name or job link.", tone: quality ? "warning" : "success" },
    { key: "duplicates", label: "Duplicate applications", value: duplicates, href: "/leads", definition: "Additional applications sharing a job link with an earlier application.", tone: duplicates ? "warning" : "default" },
    { key: "responses", label: "Recruiter responses", value: responses, href: "/leads?status=RESPONSE_RECEIVED", definition: "Applications that have moved beyond the initial applied state.", tone: "info" },
    { key: "active", label: "Active applications", value: active, href: "/leads?status=INTERVIEWING", definition: "Applications currently progressing through interviews, offers, or placement.", tone: "success" },
    { key: "followUps", label: "Follow-ups due", value: input.openFollowUps, href: "/tasks", definition: "Open follow-up actions assigned to you.", tone: input.openFollowUps ? "warning" : "default" },
    { key: "interviews", label: "Interviews to schedule", value: input.interviewsToSchedule, href: "/?calendarView=day", definition: "Recruiter responses that still need an interview scheduled.", tone: input.interviewsToSchedule ? "warning" : "default" },
  ];
}
