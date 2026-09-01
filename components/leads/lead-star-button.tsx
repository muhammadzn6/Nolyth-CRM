import { Star } from "lucide-react";

import { cn } from "@/lib/utils/cn";

export function LeadStarButton({
  active,
  disabled,
  compact = false,
  onToggle,
}: {
  active: boolean;
  disabled?: boolean;
  compact?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={active ? "Remove important" : "Mark important"}
      aria-pressed={active}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        "inline-flex items-center justify-center rounded-lg text-muted transition hover:bg-default/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft disabled:cursor-not-allowed disabled:opacity-50",
        compact ? "h-5 w-5" : "h-7 w-7",
        active && "text-accent",
      )}
    >
      <Star className={cn(compact ? "h-3 w-3" : "h-4 w-4", active && "fill-current")} />
    </button>
  );
}
