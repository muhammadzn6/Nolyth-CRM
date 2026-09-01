import { cn } from "@/lib/utils/cn";

import type { LeadSaveState } from "@/components/leads/types";

export function LeadSaveIndicator({
  state,
  onRetry,
}: {
  state: LeadSaveState;
  onRetry?: () => void;
}) {
  if (state === "idle") {
    return null;
  }

  if (state === "saving") {
    return <span className="text-[11px] text-[var(--color-text-muted)]">Saving…</span>;
  }

  if (state === "saved") {
    return <span className="text-[11px] text-[var(--color-success)]">Saved</span>;
  }

  return (
    <button
      type="button"
      onClick={onRetry}
      className={cn(
        "text-[11px] font-medium text-[var(--color-danger)] hover:underline",
      )}
    >
      Retry
    </button>
  );
}
