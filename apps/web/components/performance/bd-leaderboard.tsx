import type { PerformanceLeaderboardRow } from "@orbit/contracts";
import type { PerformancePeriod } from "./bd-team-kpis";

function percent(value: number | null): string {
  return value === null ? "N/A" : `${value.toLocaleString("en-US", { maximumFractionDigits: 1 })}%`;
}

function warningLabel(warning: PerformanceLeaderboardRow["warnings"][number]): string {
  const label = warning.replaceAll("_", " ").toLowerCase();
  return label.slice(0, 1).toUpperCase() + label.slice(1);
}

export function BdLeaderboard({ rows, period = "30d" }: { rows: PerformanceLeaderboardRow[]; period?: PerformancePeriod }) {
  return <section aria-label="BD performance leaderboard" className="rounded-[26px] border border-border bg-card p-5 shadow-sm sm:p-6">
    <header className="flex items-start justify-between gap-4">
      <div><h2 className="text-base font-bold text-foreground">Official leaderboard</h2><p className="mt-1 text-xs text-muted-foreground">Rolling score, ranked by the server.</p></div>
      <span className="rounded-full bg-primary-soft px-2.5 py-1 text-[11px] font-semibold text-primary">{rows.length} ranked</span>
    </header>
    <ol className="mt-5 space-y-3">
      {rows.length === 0 ? <li className="rounded-2xl border border-dashed border-border bg-surface-subtle p-5"><p className="text-sm font-semibold text-foreground">No official ranks yet</p><p className="mt-1 text-xs leading-5 text-muted-foreground">BDs appear here after they meet the rolling eligibility window. Check Building baseline below for early performance.</p></li> : null}
      {rows.map((row) => <li className="rounded-2xl border border-border bg-background/70 p-4" key={row.bdId}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3"><span aria-label={`Rank ${row.rank ?? "unranked"}`} className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-soft text-sm font-bold text-primary">#{row.rank ?? "—"}</span><div className="min-w-0"><h3 className="truncate text-sm font-bold text-foreground">{row.bdName}</h3><p className="text-xs text-muted-foreground">{row.qualifiedApplications.toLocaleString()} qualified applications</p></div></div>
          <div className="text-right"><p className="text-xl font-bold tracking-[-0.04em] text-foreground">{row.performance.balancedScore ?? "N/A"}</p><p className="text-[11px] text-muted-foreground">{row.performance.scoreCoveragePercent}% coverage</p></div>
        </div>
        <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3"><span>{percent(row.performance.effectiveTargetAttainmentPercent)} attainment</span><span>{percent(row.performance.followUpSlaCompliancePercent)} follow-up SLA</span><span>{percent(row.performance.maturedOutcomeScorePercent)} outcomes</span></div>
        <div className="mt-3 flex flex-wrap items-center gap-2">{row.warnings.map((warning) => <span className="rounded-full bg-warning-soft px-2 py-1 text-[10px] font-semibold text-warning-foreground" key={warning}>{warningLabel(warning)}</span>)}<span className="rounded-full bg-surface-subtle px-2 py-1 text-[10px] font-semibold text-muted-foreground">{row.performance.scoreCoverage.replaceAll("_", " ")}</span><a className="ml-auto text-xs font-semibold text-primary" href={`/?performancePeriod=${period}&performanceMetric=QUALIFIED_APPLICATIONS&performanceBdId=${row.bdId}`}>Score details →</a></div>
      </li>)}
    </ol>
    <details className="mt-4 text-xs text-muted-foreground"><summary className="cursor-pointer font-semibold text-foreground">Tie-break order</summary><p className="mt-2 leading-5">Balanced score, effective target attainment, outcome score, follow-up SLA, then BD name and ID. The API assigns every official rank.</p></details>
  </section>;
}
