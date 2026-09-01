"use client";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/table";
import { parseBulkPaste } from "@/lib/leads/parse-bulk-paste";
import type { LeadTableRow } from "@/types/lead-table";
import { Star } from "lucide-react";

import { LeadEntryRow } from "@/components/leads/lead-entry-row";
import { LeadSpreadsheetRow } from "@/components/leads/lead-spreadsheet-row";
import {
  IMPORTANT_HEADER_CLASS,
  IMPORTANT_CELL_PADDING,
  SPREADSHEET_CELL_CLASS,
  SPREADSHEET_COLUMN_COUNT,
  SPREADSHEET_COLUMN_DEFS,
} from "@/components/leads/spreadsheet-columns";
import type { DraftLeadRow, LeadSaveState } from "@/components/leads/types";

export function LeadSpreadsheet({
  profileId,
  returnQuery,
  leads,
  draftRow,
  defaults,
  isLoading,
  isLoadingMore,
  loadError,
  hasMore,
  canCreateLeads,
  canEdit,
  saveStates,
  warnings,
  searchQuery,
  onDraftChange,
  onDraftCommit,
  onBulkPaste,
  onPatch,
  onToggleImportant,
  onRetry,
  onLoadMore,
}: {
  profileId: string;
  returnQuery: string;
  leads: LeadTableRow[];
  draftRow: DraftLeadRow;
  defaults: {
    rateUnit: string;
    contractType: string;
    jobType: string;
  };
  isLoading: boolean;
  isLoadingMore: boolean;
  loadError: string | null;
  hasMore: boolean;
  canCreateLeads: boolean;
  canEdit: boolean;
  saveStates: Record<string, LeadSaveState>;
  warnings: Record<string, string>;
  searchQuery: string;
  onDraftChange: (draft: DraftLeadRow) => void;
  onDraftCommit: () => void;
  onBulkPaste: (rows: ReturnType<typeof parseBulkPaste>) => void;
  onPatch: (leadId: string, patch: Record<string, unknown>, immediate?: boolean) => void;
  onToggleImportant: (leadId: string, nextValue: boolean) => void;
  onRetry: (leadId: string) => void;
  onLoadMore: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl bg-surface">
      <div className="max-h-[calc(100vh-220px)] overflow-auto">
        <Table bare className="w-full table-fixed">
          <colgroup>
            {SPREADSHEET_COLUMN_DEFS.map((column) => (
              <col key={column.id} style={{ width: column.width }} />
            ))}
          </colgroup>
          <TableHead className="sticky top-0 z-10 backdrop-blur-sm">
            <tr>
              {SPREADSHEET_COLUMN_DEFS.map((column) => (
                <TableHeaderCell
                  key={column.id}
                  className={
                    column.id === "important"
                      ? `${IMPORTANT_HEADER_CLASS} ${IMPORTANT_CELL_PADDING} text-center`
                      : `${SPREADSHEET_CELL_CLASS} truncate`
                  }
                >
                  {column.id === "important" ? (
                    <>
                      <span className="sr-only">{column.label}</span>
                      <Star className="mx-auto h-3 w-3" aria-hidden="true" />
                    </>
                  ) : (
                    column.label
                  )}
                </TableHeaderCell>
              ))}
            </tr>
          </TableHead>
          <TableBody>
            {canCreateLeads ? (
              <LeadEntryRow
                draft={draftRow}
                defaults={defaults}
                onChange={onDraftChange}
                onCommit={onDraftCommit}
                onBulkPaste={onBulkPaste}
              />
            ) : null}

            {isLoading
              ? Array.from({ length: 8 }).map((_, index) => (
                  <TableRow key={`skeleton-${index}`}>
                    {SPREADSHEET_COLUMN_DEFS.map((column) => (
                      <td key={column.id} className={SPREADSHEET_CELL_CLASS}>
                        <Skeleton className="h-8 w-full" />
                      </td>
                    ))}
                  </TableRow>
                ))
              : null}

            {!isLoading && leads.length === 0 ? (
              <tr>
                <td colSpan={SPREADSHEET_COLUMN_COUNT} className="p-6">
                  <EmptyState
                    title={searchQuery ? `No leads found for "${searchQuery}"` : "No leads yet"}
                    description={
                      searchQuery
                        ? "Try another search term or clear the search to return to the current view."
                        : "Start entering applications in the row above."
                    }
                  />
                </td>
              </tr>
            ) : null}

            {!isLoading
              ? leads.map((lead) => (
                  <LeadSpreadsheetRow
                    key={lead.id}
                    profileId={profileId}
                    returnQuery={returnQuery}
                    lead={lead}
                    saveState={saveStates[lead.id] ?? "idle"}
                    warning={warnings[lead.id]}
                    canEdit={canEdit}
                    onPatch={(patch, immediate) => onPatch(lead.id, patch, immediate)}
                    onToggleImportant={() => onToggleImportant(lead.id, !lead.isImportant)}
                    onRetry={() => onRetry(lead.id)}
                  />
                ))
              : null}
          </TableBody>
        </Table>
      </div>

      {loadError ? (
        <div className="px-4 py-3 text-sm text-danger">{loadError}</div>
      ) : null}

      {hasMore ? (
        <div className="px-4 py-3">
          <Button variant="ghost" isDisabled={isLoadingMore} onPress={onLoadMore}>
            {isLoadingMore ? "Loading more…" : "Load more leads"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
