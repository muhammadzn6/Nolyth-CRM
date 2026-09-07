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
    <p className="mt-3 text-xs leading-5 text-muted-foreground">N/A means the period has no audited records; it is not a failure.</p>
    <ul className="mt-4 grid gap-2 sm:grid-cols-2">{indicators.map(([label, value]) => <li className="flex min-h-16 items-center justify-between gap-3 rounded-2xl bg-surface-subtle px-3 py-2.5" key={label}><span className="text-xs text-muted-foreground">{label}</span><strong className="text-sm text-foreground">{rate(value)}</strong></li>)}</ul>
  </section>;
}
