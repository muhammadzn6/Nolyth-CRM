"use client";

import { Select } from "@/components/ui/select";
import { DEAD_REASONS, LEAD_STATUSES } from "@/constants/leads";

import { DEAD_REASON_LABELS, STATUS_LABELS } from "@/components/leads/types";

const STATUS_OPTIONS = LEAD_STATUSES.map((status) => ({
  value: status,
  label: STATUS_LABELS[status],
}));

const DEAD_REASON_OPTIONS = DEAD_REASONS.map((reason) => ({
  value: reason,
  label: DEAD_REASON_LABELS[reason],
}));

export function LeadStatusSelect({
  value,
  deadReason,
  disabled,
  onChange,
}: {
  value: string;
  deadReason?: string;
  disabled?: boolean;
  onChange: (status: string, deadReason?: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Select
        value={value}
        disabled={disabled}
        onChange={(nextStatus) => {
          if (nextStatus === "DEAD") {
            onChange(nextStatus, deadReason ?? "NO_RESPONSE");
            return;
          }
          onChange(nextStatus);
        }}
        options={STATUS_OPTIONS}
        aria-label="Lead status"
        className="text-xs"
      />

      {value === "DEAD" ? (
        <Select
          value={deadReason ?? "NO_RESPONSE"}
          disabled={disabled}
          onChange={(reason) => onChange("DEAD", reason)}
          options={DEAD_REASON_OPTIONS}
          aria-label="Dead reason"
          className="text-xs"
        />
      ) : null}
    </div>
  );
}
