import type { PerformanceQualityIndicators } from "@orbit/contracts";

function rate(value: number | null): string {
  return value === null ? "N/A" : `${value.toLocaleString("en-US", { maximumFractionDigits: 1 })}%`;
}

export function QualityControl({ quality }: { quality: PerformanceQualityIndicators }) {
  const indicators = [
    ["Record health", quality.recordHealthRate],
    ["Audit pass", quality.adminAuditPassRate],
    ["Correction rate", quality.correctionRate],
    ["Confirmed duplicate rate", quality.confirmedDuplicateRate],
    ["Duplicate rate", quality.duplicateRate],
    ["Pending override", quality.pendingOverrideRate],
    ["Rejected override", quality.rejectedOverrideRate],
  ] as const;
  return <section aria-label="Application quality guardrails" className="rounded-[26px] border border-border bg-card p-5 shadow-sm sm:p-6">
    <header><h2 className="text-base font-bold text-foreground">Quality guardrails</h2><p className="mt-1 text-xs text-muted-foreground">Informational checks, kept separate from the score.</p></header>
    <ul className="mt-4 divide-y divide-border">{indicators.map(([label, value]) => <li className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0" key={label}><span className="text-sm text-muted-foreground">{label}</span><strong className="text-sm text-foreground">{rate(value)}</strong></li>)}</ul>
  </section>;
}
