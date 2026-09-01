"use client";

import { DEAD_REASON_LABELS, STATUS_LABELS } from "@/components/leads/types";
import { Select } from "@/components/ui/select";
import { TextArea } from "@/components/ui/textarea";
import { DEAD_REASONS } from "@/constants/leads";

const STATUS_OPTIONS = Object.entries(STATUS_LABELS).map(([value, label]) => ({
  value,
  label,
}));

const DEAD_REASON_OPTIONS = DEAD_REASONS.map((reason) => ({
  value: reason,
  label: DEAD_REASON_LABELS[reason],
}));

export function LeadStatusControl({
  status,
  deadReason,
  deadNotes,
  onChange,
}: {
  status: string;
  deadReason?: string;
  deadNotes?: string;
  onChange: (patch: Record<string, unknown>) => void;
}) {
  return (
    <div className="space-y-2">
      <Select
        value={status}
        onChange={(nextStatus) => {
          if (nextStatus === "DEAD") {
            onChange({
              status: nextStatus,
              deadReason: deadReason ?? "NO_RESPONSE",
              deadNotes: deadNotes ?? null,
            });
            return;
          }

          onChange({ status: nextStatus, deadReason: null });
        }}
        options={STATUS_OPTIONS}
        className="w-[180px]"
        aria-label="Lead status"
      />

      {status === "DEAD" ? (
        <div className="space-y-2 rounded-xl bg-surface-secondary p-3">
          <Select
            value={deadReason ?? "NO_RESPONSE"}
            onChange={(reason) =>
              onChange({
                status: "DEAD",
                deadReason: reason,
                deadNotes: deadNotes ?? null,
              })
            }
            options={DEAD_REASON_OPTIONS}
            aria-label="Dead reason"
          />
          <TextArea
            key={`${status}-${deadNotes ?? ""}`}
            defaultValue={deadNotes ?? ""}
            onBlur={(event) =>
              onChange({
                status: "DEAD",
                deadReason: deadReason ?? "NO_RESPONSE",
                deadNotes: event.target.value || null,
              })
            }
            placeholder="Dead notes (optional)"
            rows={2}
          />
        </div>
      ) : null}
    </div>
  );
}
