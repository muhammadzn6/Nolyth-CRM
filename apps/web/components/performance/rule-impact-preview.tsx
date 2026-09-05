"use client";

import type { PerformanceRulePreview } from "../../lib/api-client";
import { Card } from "@orbit/ui";

export function RuleImpactPreview({
  preview,
  confirmed,
  onConfirmedChange,
}: {
  preview: PerformanceRulePreview;
  confirmed: boolean;
  onConfirmedChange: (value: boolean) => void;
}) {
  return (
    <Card aria-label="Performance rule impact preview" className="border-primary/20 bg-primary-soft/35 p-5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Server-calculated</p>
          <h2 className="mt-1 text-base font-bold text-foreground">Impact preview</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            This version takes effect {new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(preview.effectiveFrom))}.
          </p>
        </div>
        <span className="text-xs font-semibold text-muted-foreground">{preview.impacts.length} BD{preview.impacts.length === 1 ? "" : "s"} affected</span>
      </div>

      <ul className="mt-4 grid gap-2" aria-label="Target impacts">
        {preview.impacts.length === 0 ? <li className="text-sm text-muted-foreground">No individual targets change.</li> : null}
        {preview.impacts.map((impact) => (
          <li className="flex items-center justify-between rounded-xl border border-border/70 bg-surface px-3 py-2.5 text-sm" key={impact.bdId}>
            <span className="font-semibold text-foreground">Current target {impact.currentTargetApplications}</span>
            <span className={impact.targetDelta === 0 ? "text-muted-foreground" : impact.targetDelta > 0 ? "font-semibold text-success" : "font-semibold text-danger"}>
              {impact.targetDelta === 0 ? "No change" : `${Math.abs(impact.targetDelta)} ${impact.targetDelta > 0 ? "more" : "fewer"} applications`}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-4 text-xs leading-5 text-muted-foreground">
        Exact future score changes cannot be calculated until future work and recruiter outcomes exist.
      </p>
      <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-surface px-3 py-3 text-sm text-foreground">
        <input
          checked={confirmed}
          className="mt-0.5 size-4 accent-primary"
          id="confirm-rule-impact"
          onChange={(event) => onConfirmedChange(event.target.checked)}
          type="checkbox"
        />
        <span>I reviewed this server-calculated impact and want to create this future-effective version.</span>
      </label>
    </Card>
  );
}
