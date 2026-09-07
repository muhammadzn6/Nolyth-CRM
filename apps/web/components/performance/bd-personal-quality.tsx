import type { BdPerformanceResponse, PerformanceQualityIndicators } from "@orbit/contracts";
import { Card } from "@orbit/ui";

function rate(value: number | null): string {
  return value === null ? "—" : `${value.toLocaleString("en-US", { maximumFractionDigits: 1 })}%`;
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
    ["Duplicate rate", quality.duplicateRate],
  ] as const;
}

export function BdPersonalQuality({ performance, performancePeriod = "30d", periodLabel = "30 days" }: { performance: BdPerformanceResponse; performancePeriod?: "day" | "7d" | "30d"; periodLabel?: string }) {
  const ownScore = performance.performance.balancedScore;
  const state = performance.eligibility.eligibilitySection === "BUILDING_BASELINE"
    ? "Building baseline"
    : performance.performance.scoreCoverage === "INSUFFICIENT_DATA"
      ? "Insufficient data"
      : title(performance.performance.scoreCoverage);
  const components = [
    ["Qualified attainment", performance.performance.effectiveTargetAttainmentPercent],
    ["Follow-up SLA", performance.performance.followUpSlaCompliancePercent],
    ["Matured outcomes", performance.performance.maturedOutcomeScorePercent],
  ] as const;
  return <Card aria-label="Personal BD performance" className="editorial-insight-card p-5 sm:p-6">
    <header className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Your details</p><h2 className="mt-1 text-xl font-bold text-foreground">Personal performance</h2><p className="mt-1 text-xs text-muted-foreground">Balanced score · {periodLabel}</p></div><div className="bd-score-block text-right"><strong className="block tracking-[-0.06em] text-foreground">{ownScore ?? "—"}</strong><span className="text-[11px] text-muted-foreground">{performance.performance.scoreCoveragePercent}% coverage</span></div></header>
    <div className="bd-score-components mt-5">{components.map(([label, value]) => <div className="bd-score-component" key={label}><div><span>{label}</span><strong>{rate(value)}</strong></div><span className="bd-score-track" aria-hidden="true"><i style={{ width: `${Math.min(value ?? 0, 100)}%` }} /></span></div>)}</div>
    <div className="bd-score-state mt-4"><div><p className="text-sm font-semibold text-foreground">{state}</p><p className="mt-0.5 text-xs text-muted-foreground">{performance.eligibility.eligible ? "Officially ranked" : performance.eligibility.ineligibilityReason ? title(performance.eligibility.ineligibilityReason) : "More activity is needed before the score is official."}</p></div><span>{performance.currentDailyTarget}/day target</span></div>
    {performance.eligibility.warnings.length ? <div className="mt-3 flex flex-wrap gap-2">{performance.eligibility.warnings.map((warning) => <span className="rounded-full bg-warning-soft px-2 py-1 text-[10px] font-semibold text-warning-foreground" key={warning}>{title(warning)}</span>)}</div> : null}
    <details className="bd-quality-details mt-4"><summary>Quality indicators</summary><dl>{qualityRows(performance.quality).map(([label, value]) => <div className="flex items-center justify-between gap-3 py-2" key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="text-xs font-semibold text-foreground">{rate(value)}</dd></div>)}</dl></details>
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">{performance.nextTargetChangeEffectiveAt ? <span className="text-xs text-muted-foreground">Next target · {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(performance.nextTargetChangeEffectiveAt))}</span> : <span />}<a className="text-xs font-semibold text-primary" href={`/?performancePeriod=${performancePeriod}&performanceMetric=QUALIFIED_APPLICATIONS`}>View your application details</a></div>
  </Card>;
}
