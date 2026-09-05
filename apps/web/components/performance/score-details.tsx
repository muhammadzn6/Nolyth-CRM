import type { PerformanceDrilldownResponse } from "@orbit/contracts";

const metricLabels: Record<string, string> = {
  QUALIFIED_APPLICATIONS: "Qualified applications",
  TARGET_ATTAINMENT: "Target attainment",
  RECRUITER_RESPONSES: "Recruiter responses",
  INTERVIEWS_SCHEDULED: "Interviews scheduled",
  INTERVIEWS_NEEDING_SCHEDULING: "Interviews needing scheduling",
  FOLLOW_UP_SLA: "Follow-up SLA",
  OUTCOMES: "Matured recruiter outcomes",
  DUPLICATE_REVIEWS: "Duplicate reviews",
  REASSIGNMENTS: "Reassignments",
};

function leadFor(item: PerformanceDrilldownResponse[number]) {
  if (item.kind === "LEAD") return item.lead;
  if (item.kind === "FOLLOW_UP") return item.followUp.lead;
  if (item.kind === "INTERVIEW") return item.interview.lead;
  return item.review.lead;
}

export function ScoreDetails({ metric, items }: { metric: string; items: PerformanceDrilldownResponse }) {
  return <details aria-label="Performance score drill-down" className="rounded-[26px] border border-border bg-card p-5 shadow-sm sm:p-6" open>
    <summary className="cursor-pointer list-none text-xs font-semibold uppercase tracking-[0.16em] text-primary">Admin drill-down</summary>
    <header><h2 className="mt-1 text-base font-bold text-foreground">{metricLabels[metric] ?? "Performance records"}</h2><p className="mt-1 text-xs text-muted-foreground">Exact records returned by the Admin-authorized endpoint.</p></header>
    {items.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">No records match this period.</p> : <ul className="mt-4 divide-y divide-border">{items.map((item) => { const lead = leadFor(item); return <li className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0" key={`${item.kind}-${lead.id}`}><div className="min-w-0"><a className="block truncate text-sm font-semibold text-foreground hover:text-primary" href={`/leads/${lead.id}`}>{lead.companyName} · {lead.jobTitle}</a><p className="mt-1 truncate text-xs text-muted-foreground">{lead.status.replaceAll("_", " ")} · applied {lead.appliedDate}</p></div><span className="rounded-full bg-surface-subtle px-2 py-1 text-[10px] font-bold text-muted-foreground">{item.kind.replaceAll("_", " ")}</span></li>; })}</ul>}
  </details>;
}
