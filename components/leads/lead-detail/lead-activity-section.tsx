"use client";

import { useCallback, useEffect, useState } from "react";

import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { formatActivityDescription } from "@/lib/leads/format-activity";
import { fetchLeadActivity } from "@/lib/leads/client-api";
import { formatDateTime } from "@/lib/utils/format";

export function LeadActivitySection({ leadId }: { leadId: string }) {
  const [items, setItems] = useState<
    Array<{
      _id: string;
      action: string;
      actorNameSnapshot: string;
      oldValue?: Record<string, unknown> | null;
      newValue?: Record<string, unknown> | null;
      metadata?: Record<string, unknown> | null;
      createdAt: string;
    }>
  >([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const loadActivity = useCallback(
    async (cursor?: string) => {
      setIsLoading(true);
      try {
        const result = await fetchLeadActivity(leadId, cursor);
        setItems((current) => (cursor ? [...current, ...result.items] : result.items));
        setNextCursor(result.nextCursor);
        setHasMore(result.hasMore);
      } finally {
        setIsLoading(false);
      }
    },
    [leadId],
  );

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      void loadActivity();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [loadActivity]);

  return (
    <section className="space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
        Activity
      </h2>

      {isLoading && items.length === 0 ? (
        <div className="space-y-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState title="No activity yet" description="Lead changes will appear here." />
      ) : (
        <div className="space-y-3">
          {items.map((event) => (
            <div
              key={event._id}
              className="rounded-xl bg-surface-secondary px-3 py-2"
            >
              <p className="text-sm font-medium text-[var(--color-text)]">
                {event.actorNameSnapshot}
              </p>
              <p className="text-sm text-[var(--color-text-muted)]">
                {formatActivityDescription({
                  action: event.action,
                  actorNameSnapshot: event.actorNameSnapshot,
                  oldValue: event.oldValue,
                  newValue: event.newValue,
                  metadata: event.metadata,
                  createdAt: event.createdAt,
                })}
              </p>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                {formatDateTime(event.createdAt)}
              </p>
            </div>
          ))}
          {hasMore ? (
            <button
              type="button"
              onClick={() => void loadActivity(nextCursor ?? undefined)}
              className="text-sm font-medium text-[var(--color-accent)] hover:underline"
            >
              Load more activity
            </button>
          ) : null}
        </div>
      )}
    </section>
  );
}
