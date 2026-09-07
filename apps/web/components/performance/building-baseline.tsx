import type { PerformanceLeaderboardRow } from "@orbit/contracts";

function reasonLabel(reason: string | null | undefined): string {
  if (!reason) return "More performance data is needed";
  const label = reason.replaceAll("_", " ").toLowerCase();
  return label.slice(0, 1).toUpperCase() + label.slice(1);
}

function dateLabel(value: string | null | undefined): string {
  return value ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(value)) : "Not available";
}

export function BuildingBaseline({ rows }: { rows: PerformanceLeaderboardRow[] }) {
  return <section aria-label="Building baseline" className="rounded-[26px] border border-border bg-card p-5 shadow-sm sm:p-6">
    <header><h2 className="text-base font-bold text-foreground">Building baseline</h2><p className="mt-1 text-xs text-muted-foreground">Visible for monitoring, but deliberately unranked.</p></header>
    {rows.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">Every active BD has an official score.</p> : <ul className="mt-4 max-h-[31rem] space-y-3 overflow-y-auto pr-1">{rows.map((row) => <li className="rounded-2xl bg-surface-subtle p-4" key={row.bdId}><div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-bold text-foreground">{row.bdName}</h3><p className="mt-1 text-xs text-muted-foreground">{reasonLabel(row.ineligibilityReason)}</p></div><span className="text-xs font-semibold text-muted-foreground">No rank</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-border"><span className="block h-full rounded-full bg-primary" style={{ width: `${row.eligibilityProgress ?? 0}%` }} /></div><div className="mt-2 flex justify-between gap-3 text-xs text-muted-foreground"><span>{row.eligibilityProgress ?? 0}% complete</span><span>Est. {dateLabel(row.estimatedEligibilityDate)}</span></div></li>)}</ul>}
  </section>;
}
