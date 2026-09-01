"use client";

import { useCallback, useEffect, useState } from "react";

import {
  INTERVIEW_ROUND_RESULT_LABELS,
  INTERVIEW_ROUND_TYPE_LABELS,
} from "@/components/leads/types";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { TextArea } from "@/components/ui/textarea";
import { INTERVIEW_ROUND_RESULTS, INTERVIEW_ROUND_TYPES } from "@/constants/leads";
import {
  createLeadRound,
  fetchLeadRounds,
  patchLeadRound,
} from "@/lib/leads/client-api";
import { formatDateTime, formatRelativeTime } from "@/lib/utils/format";
import type { InterviewRoundRow } from "@/types/interview-round";

const ROUND_TYPE_OPTIONS = INTERVIEW_ROUND_TYPES.map((type) => ({
  value: type,
  label: INTERVIEW_ROUND_TYPE_LABELS[type],
}));

const ROUND_RESULT_OPTIONS = INTERVIEW_ROUND_RESULTS.map((result) => ({
  value: result,
  label: INTERVIEW_ROUND_RESULT_LABELS[result],
}));

export function LeadRoundsSection({
  leadId,
  canEdit,
  onRoundsChanged,
}: {
  leadId: string;
  canEdit: boolean;
  onRoundsChanged: () => void;
}) {
  const [rounds, setRounds] = useState<InterviewRoundRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [draft, setDraft] = useState({
    roundType: "SCREENING",
    scheduledAt: "",
    interviewerName: "",
    meetingLink: "",
    result: "SCHEDULED",
    notes: "",
  });

  const loadRounds = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchLeadRounds(leadId);
      setRounds(data);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load rounds");
    } finally {
      setIsLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      void loadRounds();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [loadRounds]);

  const handleCreate = async () => {
    setIsAdding(true);
    try {
      await createLeadRound(leadId, {
        roundType: draft.roundType,
        scheduledAt: draft.scheduledAt || undefined,
        interviewerName: draft.interviewerName || undefined,
        meetingLink: draft.meetingLink || undefined,
        result: draft.result,
        notes: draft.notes || undefined,
      });
      setDraft({
        roundType: "SCREENING",
        scheduledAt: "",
        interviewerName: "",
        meetingLink: "",
        result: "SCHEDULED",
        notes: "",
      });
      await loadRounds();
      onRoundsChanged();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Couldn't add round");
    } finally {
      setIsAdding(false);
    }
  };

  const handleRoundPatch = async (round: InterviewRoundRow, patch: Record<string, unknown>) => {
    try {
      const updated = await patchLeadRound(leadId, round.id, patch);
      setRounds((current) => current.map((item) => (item.id === round.id ? updated : item)));
      onRoundsChanged();
    } catch (patchError) {
      setError(patchError instanceof Error ? patchError.message : "Couldn't update round");
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="orbit-muted-label">Interview rounds</h2>
        {canEdit ? (
          <Button type="button" onPress={() => void handleCreate()} isDisabled={isAdding}>
            {isAdding ? "Adding…" : "Add round"}
          </Button>
        ) : null}
      </div>

      {canEdit ? (
        <div className="grid gap-2 rounded-xl bg-surface-secondary p-3 md:grid-cols-2">
          <Select
            value={draft.roundType}
            onChange={(value) => setDraft({ ...draft, roundType: value })}
            options={ROUND_TYPE_OPTIONS}
            aria-label="Round type"
          />
          <Input
            type="datetime-local"
            value={draft.scheduledAt}
            onChange={(event) => setDraft({ ...draft, scheduledAt: event.target.value })}
            aria-label="Scheduled at"
          />
          <Input
            placeholder="Interviewer"
            value={draft.interviewerName}
            onChange={(event) => setDraft({ ...draft, interviewerName: event.target.value })}
          />
          <Input
            placeholder="Meeting link"
            value={draft.meetingLink}
            onChange={(event) => setDraft({ ...draft, meetingLink: event.target.value })}
          />
          <Select
            value={draft.result}
            onChange={(value) => setDraft({ ...draft, result: value })}
            options={ROUND_RESULT_OPTIONS}
            aria-label="Round result"
          />
          <TextArea
            placeholder="Notes"
            value={draft.notes}
            onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
            rows={2}
            className="md:col-span-2"
          />
        </div>
      ) : null}

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : rounds.length === 0 ? (
        <EmptyState title="No interview rounds yet" description="Add a round when interviews begin." />
      ) : (
        <div className="space-y-3">
          {rounds.map((round) => (
            <article
              key={round.id}
              className="space-y-2 rounded-xl bg-surface-secondary px-4 py-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Round {round.roundNumber} · {INTERVIEW_ROUND_TYPE_LABELS[round.roundType]}
                  </p>
                  <p className="text-xs text-muted">
                    {round.scheduledAt ? formatDateTime(round.scheduledAt) : "No date set"} ·{" "}
                    {INTERVIEW_ROUND_RESULT_LABELS[round.result]}
                  </p>
                </div>
                <p className="text-xs text-muted">
                  Added by {round.createdByName} · {formatRelativeTime(round.updatedAt)}
                </p>
              </div>

              {canEdit ? (
                <div className="grid gap-2 md:grid-cols-2">
                  <Select
                    value={round.result}
                    onChange={(value) => void handleRoundPatch(round, { result: value })}
                    options={ROUND_RESULT_OPTIONS}
                    aria-label="Round result"
                  />
                  <Input
                    defaultValue={round.interviewerName ?? ""}
                    placeholder="Interviewer"
                    onBlur={(event) =>
                      void handleRoundPatch(round, {
                        interviewerName: event.target.value || null,
                      })
                    }
                  />
                  <Input
                    defaultValue={round.meetingLink ?? ""}
                    placeholder="Meeting link"
                    onBlur={(event) =>
                      void handleRoundPatch(round, { meetingLink: event.target.value || null })
                    }
                  />
                  <TextArea
                    defaultValue={round.notes ?? ""}
                    rows={3}
                    placeholder="Round notes"
                    className="md:col-span-2"
                    onBlur={(event) =>
                      void handleRoundPatch(round, { notes: event.target.value || null })
                    }
                  />
                </div>
              ) : round.notes ? (
                <p className="text-sm text-foreground">{round.notes}</p>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
