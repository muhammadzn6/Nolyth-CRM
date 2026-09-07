import type { PerformanceKpi } from "@orbit/contracts";

export type PerformancePeriod = "day" | "7d" | "30d";

const periodLabels: Record<PerformancePeriod, string> = {
  day: "Today",
  "7d": "7 days",
  "30d": "30 days",
};

function percent(value: number): string {
  return `${value.toLocaleString("en-US", { maximumFractionDigits: 1 })}%`;
}

function performanceHref(period: PerformancePeriod, metric: string): string {
  return `/?performancePeriod=${period}&performanceMetric=${metric}`;
}

export function BdTeamKpis({ performance, period }: { performance: PerformanceKpi; period: PerformancePeriod }) {
  const cards = [
    {
      label: "Qualified applications",
      value: performance.qualifiedApplications.toLocaleString(),
      detail: `${performance.targetApplications.toLocaleString()} target`,
      metric: "QUALIFIED_APPLICATIONS",
      tone: "bg-primary-soft/65",
    },
    {
      label: "Target attainment",
      value: percent(performance.effectiveTargetAttainmentPercent),
      detail: `${percent(performance.rawTargetAttainmentPercent)} raw`,
      metric: "TARGET_ATTAINMENT",
      tone: "bg-success-soft/70",
    },
    {
      label: "Recruiter responses",
      value: performance.recruiterResponses.toLocaleString(),
      detail: "Response records",
      metric: "RECRUITER_RESPONSES",
      tone: "bg-[#f8f1ed]",
    },
    {
      label: "Interviews scheduled",
      value: performance.interviewsScheduled.toLocaleString(),
      detail: "Scheduled interviews",
      metric: "INTERVIEWS_SCHEDULED",
      tone: "bg-[#fff0eb]",
    },
    {
      label: "Interviews needing scheduling",
      value: performance.interviewsNeedingScheduling.toLocaleString(),
      detail: "Recruiter responses awaiting a calendar entry",
      metric: "INTERVIEWS_NEEDING_SCHEDULING",
      tone: "bg-warning-soft/75",
    },
  ] as const;

  return <section aria-label="BD team performance KPIs">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">BD performance</p>
        <h2 className="mt-1 text-xl font-bold tracking-[-0.03em] text-foreground">Team performance</h2>
      </div>
      <nav aria-label="Performance period" className="inline-flex w-fit rounded-full border border-border bg-surface-subtle p-1 text-xs">
        {(Object.keys(periodLabels) as PerformancePeriod[]).map((option) => <a aria-current={option === period ? "page" : undefined} className={`rounded-full px-3 py-1.5 font-semibold ${option === period ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`} href={`/?performancePeriod=${option}`} key={option}>{periodLabels[option]}</a>)}
      </nav>
    </header>
    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {cards.map((card) => <a className={`rounded-[22px] border border-white/80 p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/25 ${card.tone}`} href={performanceHref(period, card.metric)} key={card.label}>
        <p className="text-xs font-semibold text-muted-foreground">{card.label}</p>
        <p className="mt-2 text-3xl font-bold tracking-[-0.05em] text-foreground">{card.value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{card.detail}</p>
        <span className="mt-3 block text-xs font-semibold text-primary">View records →</span>
      </a>)}
    </div>
  </section>;
}
