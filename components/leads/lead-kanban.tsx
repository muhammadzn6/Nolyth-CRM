"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { KanbanCardItem } from "@/components/leads/kanban-card";
import { STATUS_LABELS } from "@/components/leads/types";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { LEAD_STATUSES, type LeadStatus } from "@/constants/leads";
import { fetchProfileKanban, patchLead, type KanbanQuery } from "@/lib/leads/client-api";
import type { KanbanBoardResult } from "@/types/kanban";

export function LeadKanbanBoard({
  profileId,
  canEdit,
  query,
}: {
  profileId: string;
  canEdit: boolean;
  query: KanbanQuery;
}) {
  const searchParams = useSearchParams();
  const returnQuery = searchParams.toString();
  const [board, setBoard] = useState<KanbanBoardResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingColumn, setLoadingColumn] = useState<LeadStatus | null>(null);

  const loadBoard = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchProfileKanban(profileId, query);
      setBoard(data);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load kanban");
    } finally {
      setIsLoading(false);
    }
  }, [profileId, query]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      void loadBoard();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [loadBoard]);

  const handleLoadMore = async (status: LeadStatus) => {
    if (!board?.columns[status].nextCursor) {
      return;
    }

    setLoadingColumn(status);
    try {
      const more = await fetchProfileKanban(profileId, {
        ...query,
        column: status,
        cursor: board.columns[status].nextCursor ?? undefined,
      });
      setBoard((current) =>
        current
          ? {
              ...current,
              columns: {
                ...current.columns,
                [status]: {
                  items: [...current.columns[status].items, ...more.columns[status].items],
                  nextCursor: more.columns[status].nextCursor,
                  hasMore: more.columns[status].hasMore,
                },
              },
            }
          : current,
      );
    } finally {
      setLoadingColumn(null);
    }
  };

  const handlePatch = async (leadId: string, patch: Record<string, unknown>) => {
    await patchLead(leadId, patch);
    await loadBoard();
  };

  const columns = useMemo(() => LEAD_STATUSES, []);

  if (isLoading && !board) {
    return (
      <div className="grid gap-3 xl:grid-cols-5">
        {columns.map((status) => (
          <Skeleton key={status} className="h-64 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-danger">{error}</p>;
  }

  if (!board) {
    return null;
  }

  return (
    <div className="grid gap-3 xl:grid-cols-5">
      {columns.map((status) => (
        <section
          key={status}
          className="flex min-h-[320px] flex-col rounded-xl bg-surface-secondary"
        >
          <header className="px-3 py-2.5">
            <h3 className="text-sm font-semibold text-foreground">
              {STATUS_LABELS[status]}
            </h3>
            <p className="text-xs text-muted">{board.counts[status]} leads</p>
          </header>

          <div className="flex-1 space-y-2 overflow-y-auto p-2">
            {board.columns[status].items.map((card) => (
              <KanbanCardItem
                key={card.id}
                profileId={profileId}
                card={card}
                returnQuery={returnQuery}
                canEdit={canEdit}
                onPatch={(patch) => void handlePatch(card.id, patch)}
                onToggleImportant={() =>
                  void handlePatch(card.id, { isImportant: !card.isImportant })
                }
              />
            ))}

            {board.columns[status].hasMore ? (
              <Button
                variant="ghost"
                fullWidth
                isDisabled={loadingColumn === status}
                onPress={() => void handleLoadMore(status)}
                className="text-xs"
              >
                {loadingColumn === status ? "Loading…" : "Load more"}
              </Button>
            ) : null}
          </div>
        </section>
      ))}
    </div>
  );
}
