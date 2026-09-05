import type { BdPerformanceResponse, PerformanceQualityIndicators } from "@orbit/contracts";
import { Card } from "@orbit/ui";

function rate(value: number | null): string {
  return value === null ? "N/A" : `${value.toLocaleString("en-US", { maximumFractionDigits: 1 })}%`;
}

function title(value: string): string {
  const label = value.replaceAll("_", " ").toLowerCase();
  return `${label.slice(0, 1).toUpperCase()}${label.slice(1)}`;
}

function qualityRows(quality: PerformanceQualityIndicators) {
  return [
    ["Record health", quality.recordHealthRate],
    ["Audit pass", quality.adminAuditPassRate],
    ["Correction rate", quality.correctionRate],
    ["Confirmed duplicate rate", quality.confirmedDuplicateRate],
    ["Duplicate rate", quality.duplicateRate],
  ] as const;
}

export function BdPersonalQuality({ performance }: { performance: BdPerformanceResponse }) {
  const ownScore = performance.performance.balancedScore;
  const state = performance.eligibility.eligibilitySection === "BUILDING_BASELINE"
    ? "Building baseline"
    : performance.performance.scoreCoverage === "INSUFFICIENT_DATA"
      ? "Insufficient data"
      : title(performance.performance.scoreCoverage);
  return <Card aria-label="Personal BD performance" className="editorial-insight-card p-5 sm:p-6">
    <header className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Your details</p><h2 className="mt-1 text-base font-bold text-foreground">Personal performance</h2><p className="mt-1 text-xs text-muted-foreground">Rolling 30-day score, calculated by Orbit.</p></div><div className="text-right"><strong className="block text-2xl tracking-[-0.04em] text-foreground">{ownScore ?? "N/A"}</strong><span className="text-[11px] text-muted-foreground">{performance.performance.scoreCoveragePercent}% coverage</span></div></header>
    <div className="mt-4 rounded-2xl bg-surface-subtle p-3"><p className="text-sm font-semibold text-foreground">{state}</p><p className="mt-1 text-xs text-muted-foreground">{performance.eligibility.eligible ? "Officially ranked" : performance.eligibility.ineligibilityReason ? title(performance.eligibility.ineligibilityReason) : "More activity is needed before the score is official."}</p></div>
    {performance.eligibility.warnings.length ? <div className="mt-3 flex flex-wrap gap-2">{performance.eligibility.warnings.map((warning) => <span className="rounded-full bg-warning-soft px-2 py-1 text-[10px] font-semibold text-warning-foreground" key={warning}>{title(warning)}</span>)}</div> : null}
    <dl className="mt-4 divide-y divide-border">{qualityRows(performance.quality).map(([label, value]) => <div className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0" key={label}><dt className="text-sm text-muted-foreground">{label}</dt><dd className="text-sm font-semibold text-foreground">{rate(value)}</dd></div>)}</dl>
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4"><span className="text-xs text-muted-foreground">Effective target: {performance.currentDailyTarget}/day</span>{performance.nextTargetChangeEffectiveAt ? <span className="text-xs text-muted-foreground">Next target: {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(performance.nextTargetChangeEffectiveAt))}</span> : null}<a className="text-xs font-semibold text-primary" href="/?performanceMetric=QUALIFIED_APPLICATIONS">View your application details</a></div>
  </Card>;
}
