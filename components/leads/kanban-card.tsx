"use client";

import Link from "next/link";

import { LeadStarButton } from "@/components/leads/lead-star-button";
import { STATUS_LABELS } from "@/components/leads/types";
import { formatRate, formatRelativeTime } from "@/lib/utils/format";
import type { KanbanCard } from "@/types/kanban";
import { LeadStatusControl } from "@/components/leads/lead-status-control";

export function KanbanCardItem({
  profileId,
  card,
  returnQuery,
  canEdit,
  onPatch,
  onToggleImportant,
}: {
  profileId: string;
  card: KanbanCard;
  returnQuery: string;
  canEdit: boolean;
  onPatch: (patch: Record<string, unknown>) => void;
  onToggleImportant: () => void;
}) {
  const detailHref = `/profiles/${profileId}/leads/${card.id}?return=${encodeURIComponent(returnQuery)}`;

  return (
    <article className="rounded-xl bg-surface-secondary p-3">
      <div className="mb-2 flex items-start justify-between gap-2">
        <Link href={detailHref} className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">
            {card.companyName}
          </p>
          <p className="truncate text-xs text-muted">
            {card.jobTitle || "No title"}
          </p>
        </Link>
        <LeadStarButton active={card.isImportant} disabled={!canEdit} onToggle={onToggleImportant} />
      </div>

      <div className="space-y-1 text-xs text-muted">
        <p>{formatRate(card.rateAmount, card.rateUnit)}</p>
        <p>
          {card.contractType ?? "—"} · {card.jobType ?? "—"} · {card.roundCount} rounds
        </p>
        <p>{formatRelativeTime(card.updatedAt)}</p>
      </div>

      {canEdit ? (
        <div className="mt-3" onClick={(event) => event.stopPropagation()}>
          <LeadStatusControl
            status={card.status}
            onChange={onPatch}
          />
        </div>
      ) : (
        <p className="mt-2 text-xs text-muted">{STATUS_LABELS[card.status]}</p>
      )}
    </article>
  );
}
