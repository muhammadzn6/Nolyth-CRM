"use client";

import { useRef } from "react";

import type { DraftLeadRow } from "@/components/leads/types";
import {
  IMPORTANT_ENTRY_CLASS,
  IMPORTANT_CELL_PADDING,
  SPREADSHEET_CELL_CLASS,
} from "@/components/leads/spreadsheet-columns";
import { RATE_UNIT_LABELS } from "@/components/leads/types";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { RATE_UNITS } from "@/constants/leads";
import { parseBulkPaste } from "@/lib/leads/parse-bulk-paste";

const RATE_UNIT_OPTIONS = [
  { value: "", label: "Unit" },
  ...RATE_UNITS.map((unit) => ({ value: unit, label: RATE_UNIT_LABELS[unit] })),
];

export function LeadEntryRow({
  draft,
  defaults,
  onChange,
  onCommit,
  onBulkPaste,
}: {
  draft: DraftLeadRow;
  defaults: {
    rateUnit: string;
    contractType: string;
    jobType: string;
  };
  onChange: (draft: DraftLeadRow) => void;
  onCommit: () => void;
  onBulkPaste: (rows: ReturnType<typeof parseBulkPaste>) => void;
}) {
  const companyRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const urlRef = useRef<HTMLInputElement>(null);

  const update = (patch: Partial<DraftLeadRow>) => {
    onChange({ ...draft, ...patch });
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    const text = event.clipboardData.getData("text/plain");
    if (!text.includes("\t") && !text.includes("\n")) {
      return;
    }

    const rows = parseBulkPaste(text);
    if (rows.length > 1) {
      event.preventDefault();
      onBulkPaste(rows);
    }
  };

  return (
    <tr className="bg-accent-soft/20">
      <td className={`${IMPORTANT_ENTRY_CLASS} ${IMPORTANT_CELL_PADDING}`} />
      <td className={`${SPREADSHEET_CELL_CLASS} text-xs text-muted`}>Auto</td>
      <td className={SPREADSHEET_CELL_CLASS}>
        <Input
          ref={companyRef}
          value={draft.companyName}
          onChange={(event) => update({ companyName: event.target.value })}
          onPaste={handlePaste}
          onKeyDown={(event) => {
            if (event.key === "Tab" && !event.shiftKey) {
              event.preventDefault();
              titleRef.current?.focus();
            }
            if (event.key === "Enter") {
              event.preventDefault();
              titleRef.current?.focus();
            }
          }}
          placeholder="Company"
          aria-label="Company"
          className="h-8 w-full min-w-0 text-sm"
        />
      </td>
      <td className={SPREADSHEET_CELL_CLASS}>
        <Input
          ref={titleRef}
          value={draft.jobTitle}
          onChange={(event) => update({ jobTitle: event.target.value })}
          onKeyDown={(event) => {
            if (event.key === "Tab" && !event.shiftKey) {
              event.preventDefault();
              urlRef.current?.focus();
            }
            if (event.key === "Tab" && event.shiftKey) {
              event.preventDefault();
              companyRef.current?.focus();
            }
          }}
          placeholder="Job title"
          aria-label="Job title"
          className="h-8 w-full min-w-0 text-sm"
        />
      </td>
      <td className={SPREADSHEET_CELL_CLASS}>
        <Input
          ref={urlRef}
          value={draft.jobUrl}
          onChange={(event) => update({ jobUrl: event.target.value })}
          onPaste={handlePaste}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onCommit();
              companyRef.current?.focus();
            }
            if (event.key === "Tab" && event.shiftKey) {
              event.preventDefault();
              titleRef.current?.focus();
            }
          }}
          placeholder="URL"
          aria-label="Job URL"
          className="h-8 w-full min-w-0 text-sm"
        />
      </td>
      <td className={SPREADSHEET_CELL_CLASS}>
        <Input
          value={draft.rateAmount}
          onChange={(event) => update({ rateAmount: event.target.value })}
          placeholder="Rate"
          aria-label="Rate"
          className="h-8 w-full min-w-0 text-right text-sm"
        />
      </td>
      <td className={SPREADSHEET_CELL_CLASS}>
        <Select
          value={draft.rateUnit || defaults.rateUnit}
          onChange={(value) => update({ rateUnit: value })}
          options={RATE_UNIT_OPTIONS}
          aria-label="Rate unit"
          className="w-full min-w-0 text-xs"
        />
      </td>
      <td className={`${SPREADSHEET_CELL_CLASS} text-xs text-muted`}>Applied</td>
      <td className={`${SPREADSHEET_CELL_CLASS} text-center text-xs text-muted`}>0</td>
      <td className={`${SPREADSHEET_CELL_CLASS} truncate text-[11px] text-muted`}>
        Paste TSV
      </td>
    </tr>
  );
}
