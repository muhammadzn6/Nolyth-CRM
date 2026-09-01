"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";

import { LeadKanbanBoard } from "@/components/leads/lead-kanban";
import { LeadSpreadsheet } from "@/components/leads/lead-spreadsheet";
import { LeadStatusTabs, LeadWorkspaceHeader } from "@/components/leads/lead-workspace-header";
import { useLeadWorkspace } from "@/components/leads/use-lead-workspace";

function ProfileLeadWorkspaceContent({
  profileId,
  profileName,
  assignedBd,
  assignedCloser,
  canCreateLeads,
  canEdit,
}: {
  profileId: string;
  profileName: string;
  assignedBd?: string;
  assignedCloser?: string;
  canCreateLeads: boolean;
  canEdit: boolean;
}) {
  const workspace = useLeadWorkspace(profileId, canCreateLeads);
  const searchParams = useSearchParams();
  const returnQuery = searchParams.toString();

  const kanbanQuery = useMemo(
    () => ({
      q: workspace.workspaceQuery.q || undefined,
      important: workspace.workspaceQuery.important,
      contractType: workspace.workspaceQuery.contractType,
      jobType: workspace.workspaceQuery.jobType,
      rateUnit: workspace.workspaceQuery.rateUnit,
      dateFrom: workspace.workspaceQuery.dateFrom,
      dateTo: workspace.workspaceQuery.dateTo,
    }),
    [workspace.workspaceQuery],
  );

  return (
    <div className="space-y-4">
      <LeadWorkspaceHeader
        profileName={profileName}
        leadCount={workspace.leads.length}
        assignedBd={assignedBd}
        assignedCloser={assignedCloser}
        searchInput={workspace.searchInput}
        sort={workspace.workspaceQuery.sort}
        mode={workspace.workspaceQuery.mode}
        filters={{
          contractType: workspace.workspaceQuery.contractType,
          jobType: workspace.workspaceQuery.jobType,
          rateUnit: workspace.workspaceQuery.rateUnit,
          dateFrom: workspace.workspaceQuery.dateFrom,
          dateTo: workspace.workspaceQuery.dateTo,
        }}
        onSearchChange={workspace.setSearchInput}
        onSortChange={(sort) => workspace.updateQuery({ sort })}
        onFilterChange={(patch) => workspace.updateQuery(patch)}
        onModeChange={(mode) => workspace.updateQuery({ mode })}
      />

      {workspace.workspaceQuery.mode === "table" ? (
        <>
          <LeadStatusTabs
            activeView={workspace.workspaceQuery.view}
            onChange={(view) => workspace.updateQuery({ view })}
          />

          <LeadSpreadsheet
            profileId={profileId}
            returnQuery={returnQuery}
            leads={workspace.leads}
            draftRow={workspace.draftRow}
            defaults={workspace.sessionDefaults}
            isLoading={workspace.isLoading}
            isLoadingMore={workspace.isLoadingMore}
            loadError={workspace.loadError}
            hasMore={workspace.hasMore}
            canCreateLeads={canCreateLeads}
            canEdit={canEdit}
            saveStates={workspace.saveStates}
            warnings={workspace.warnings}
            searchQuery={workspace.workspaceQuery.q}
            onDraftChange={workspace.setDraftRow}
            onDraftCommit={() => void workspace.commitDraftRow()}
            onBulkPaste={(rows) => void workspace.handleBulkPaste(rows)}
            onPatch={(leadId, patch, immediate) => {
              workspace.updateLeadLocal(leadId, patch as never);
              void workspace.persistLeadPatch(leadId, patch, immediate);
            }}
            onToggleImportant={(leadId, nextValue) => {
              workspace.updateLeadLocal(leadId, { isImportant: nextValue });
              void workspace.persistLeadPatch(leadId, { isImportant: nextValue }, true);
            }}
            onRetry={workspace.retrySave}
            onLoadMore={workspace.loadMore}
          />
        </>
      ) : (
        <LeadKanbanBoard profileId={profileId} canEdit={canEdit} query={kanbanQuery} />
      )}
    </div>
  );
}

export function ProfileLeadWorkspace(props: {
  profileId: string;
  profileName: string;
  assignedBd?: string;
  assignedCloser?: string;
  canCreateLeads: boolean;
  canEdit: boolean;
}) {
  return (
    <Suspense fallback={<div className="text-sm text-[var(--color-text-muted)]">Loading workspace…</div>}>
      <ProfileLeadWorkspaceContent {...props} />
    </Suspense>
  );
}
