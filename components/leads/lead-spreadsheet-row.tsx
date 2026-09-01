"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";

import { EditableCell } from "@/components/leads/editable-cell";
import { JobUrlCell } from "@/components/leads/job-url-cell";
import { LeadSaveIndicator } from "@/components/leads/lead-save-indicator";
import { LeadStarButton } from "@/components/leads/lead-star-button";
import { LeadStatusSelect } from "@/components/leads/lead-status-select";
import {
  IMPORTANT_CELL_CLASS,
  IMPORTANT_CELL_PADDING,
  SPREADSHEET_CELL_CLASS,
} from "@/components/leads/spreadsheet-columns";
import type { LeadSaveState } from "@/components/leads/types";
import { RATE_UNIT_LABELS } from "@/components/leads/types";
import { Select } from "@/components/ui/select";
import { RATE_UNITS } from "@/constants/leads";
import type { LeadTableRow } from "@/types/lead-table";

const RATE_UNIT_OPTIONS = [
  { value: "", label: "—" },
  ...RATE_UNITS.map((unit) => ({ value: unit, label: RATE_UNIT_LABELS[unit] })),
];

export function LeadSpreadsheetRow({
  profileId,
  returnQuery,
  lead,
  saveState,
  warning,
  canEdit,
  onPatch,
  onToggleImportant,
  onRetry,
}: {
  profileId: string;
  returnQuery: string;
  lead: LeadTableRow;
  saveState: LeadSaveState;
  warning?: string;
  canEdit: boolean;
  onPatch: (patch: Record<string, unknown>, immediate?: boolean) => void;
  onToggleImportant: () => void;
  onRetry: () => void;
}) {
  return (
    <tr className="group transition-colors hover:bg-default/30">
      <td className={`${IMPORTANT_CELL_CLASS} ${IMPORTANT_CELL_PADDING}`}>
        <div className="flex justify-center">
          <LeadStarButton
            active={lead.isImportant}
            disabled={!canEdit}
            compact
            onToggle={onToggleImportant}
          />
        </div>
      </td>
      <td className={`${SPREADSHEET_CELL_CLASS} whitespace-nowrap text-sm text-muted`}>
        {new Date(lead.appliedDate).toLocaleDateString()}
      </td>
      <td className={SPREADSHEET_CELL_CLASS}>
        <div className="flex min-w-0 items-center gap-1">
          <div className="min-w-0 flex-1">
            <EditableCell
              value={lead.companyName}
              readOnly={!canEdit}
              onCommit={(value) => onPatch({ companyName: value })}
            />
          </div>
          <Link
            href={`/profiles/${profileId}/leads/${lead.id}?return=${encodeURIComponent(returnQuery)}`}
            aria-label="Open lead detail"
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-default/60 hover:text-accent"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
      </td>
      <td className={SPREADSHEET_CELL_CLASS}>
        <EditableCell
          value={lead.jobTitle ?? ""}
          readOnly={!canEdit}
          onCommit={(value) => onPatch({ jobTitle: value || null })}
        />
      </td>
      <td className={SPREADSHEET_CELL_CLASS}>
        <JobUrlCell
          value={lead.jobUrl}
          readOnly={!canEdit}
          onCommit={(value) => onPatch({ jobUrl: value })}
        />
        {warning ? (
          <p className="pt-1 text-[11px] text-warning">{warning}</p>
        ) : null}
      </td>
      <td className={SPREADSHEET_CELL_CLASS}>
        <EditableCell
          value={lead.rateAmount?.toString() ?? ""}
          type="number"
          align="right"
          readOnly={!canEdit}
          displayValue={lead.rateAmount ? String(lead.rateAmount) : "—"}
          onCommit={(value) =>
            onPatch({
              rateAmount: value ? Number(value) : null,
            })
          }
        />
      </td>
      <td className={SPREADSHEET_CELL_CLASS}>
        {canEdit ? (
          <Select
            value={lead.rateUnit ?? ""}
            onChange={(value) => onPatch({ rateUnit: value || null }, true)}
            options={RATE_UNIT_OPTIONS}
            aria-label="Rate unit"
            className="text-xs"
          />
        ) : (
          <div className="px-1 py-1.5 text-sm text-muted">
            {lead.rateUnit ? RATE_UNIT_LABELS[lead.rateUnit] : "—"}
          </div>
        )}
      </td>
      <td className={SPREADSHEET_CELL_CLASS}>
        {canEdit ? (
          <LeadStatusSelect
            value={lead.status}
            deadReason={lead.deadReason}
            onChange={(status, deadReason) =>
              onPatch(
                {
                  status,
                  ...(status === "DEAD"
                    ? { deadReason: deadReason ?? "NO_RESPONSE" }
                    : { deadReason: null }),
                },
                true,
              )
            }
          />
        ) : (
          <div className="px-1 py-1.5 text-sm">{lead.status}</div>
        )}
      </td>
      <td className={`${SPREADSHEET_CELL_CLASS} text-center text-sm text-muted`}>
        {lead.roundCount}
      </td>
      <td className={SPREADSHEET_CELL_CLASS}>
        <LeadSaveIndicator state={saveState} onRetry={onRetry} />
      </td>
    </tr>
  );
}
