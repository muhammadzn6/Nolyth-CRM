"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { LeadWorkspaceMode, LeadWorkspaceSort, LeadWorkspaceView } from "@/components/leads/types";
import { createDraftRow } from "@/components/leads/types";
import {
  createProfileLead,
  fetchProfileLeads,
  patchLead,
  type LeadListQuery,
} from "@/lib/leads/client-api";
import { createDebouncer, LeadMutationQueue } from "@/lib/leads/mutation-queue";
import { parseBulkPaste } from "@/lib/leads/parse-bulk-paste";
import type { LeadTableRow } from "@/types/lead-table";

const TEXT_SAVE_DEBOUNCE_MS = 450;

type WorkspaceQueryState = {
  view: LeadWorkspaceView;
  mode: LeadWorkspaceMode;
  q: string;
  sort: LeadWorkspaceSort;
  important?: boolean;
  contractType?: string;
  jobType?: string;
  rateUnit?: string;
  dateFrom?: string;
  dateTo?: string;
};

function parseView(value: string | null): LeadWorkspaceView {
  const allowed: LeadWorkspaceView[] = [
    "all",
    "applied",
    "in_process",
    "final_round",
    "closed",
    "dead",
    "important",
  ];

  if (value && allowed.includes(value as LeadWorkspaceView)) {
    return value as LeadWorkspaceView;
  }

  return "applied";
}

function parseSort(value: string | null): LeadWorkspaceSort {
  const allowed: LeadWorkspaceSort[] = ["newest", "oldest", "company", "updated", "important"];
  if (value && allowed.includes(value as LeadWorkspaceSort)) {
    return value as LeadWorkspaceSort;
  }

  return "newest";
}

function parseMode(value: string | null): LeadWorkspaceMode {
  return value === "kanban" ? "kanban" : "table";
}

function readWorkspaceQuery(searchParams: URLSearchParams): WorkspaceQueryState {
  return {
    view: parseView(searchParams.get("view")),
    mode: parseMode(searchParams.get("mode")),
    q: searchParams.get("q") ?? "",
    sort: parseSort(searchParams.get("sort")),
    important:
      searchParams.get("important") === "true"
        ? true
        : searchParams.get("important") === "false"
          ? false
          : undefined,
    contractType: searchParams.get("contractType") ?? undefined,
    jobType: searchParams.get("jobType") ?? undefined,
    rateUnit: searchParams.get("rateUnit") ?? undefined,
    dateFrom: searchParams.get("dateFrom") ?? undefined,
    dateTo: searchParams.get("dateTo") ?? undefined,
  };
}

function toLeadListQuery(state: WorkspaceQueryState, cursor?: string): LeadListQuery {
  return {
    view: state.q ? undefined : state.view,
    q: state.q || undefined,
    sort: state.sort,
    important: state.important,
    contractType: state.contractType,
    jobType: state.jobType,
    rateUnit: state.rateUnit,
    dateFrom: state.dateFrom,
    dateTo: state.dateTo,
    cursor,
    limit: 50,
  };
}

export function useLeadWorkspace(profileId: string, canCreateLeads: boolean) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const workspaceQuery = useMemo(() => readWorkspaceQuery(searchParams), [searchParams]);

  const [leads, setLeads] = useState<LeadTableRow[]>([]);
  const [draftRow, setDraftRow] = useState(createDraftRow);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveStates, setSaveStates] = useState<Record<string, "idle" | "saving" | "saved" | "error">>({});
  const [warnings, setWarnings] = useState<Record<string, string>>({});
  const [sessionDefaults, setSessionDefaults] = useState({
    rateUnit: "",
    contractType: "",
    jobType: "",
  });

  const mutationQueue = useRef(new LeadMutationQueue());
  const debouncer = useRef(createDebouncer(TEXT_SAVE_DEBOUNCE_MS));
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [searchInput, setSearchInput] = useState(workspaceQuery.q);

  const updateQuery = useCallback(
    (updates: Partial<WorkspaceQueryState>) => {
      const params = new URLSearchParams(searchParams.toString());

      const next = {
        ...workspaceQuery,
        ...updates,
      };

      params.set("view", next.view);
      if (next.mode !== "table") params.set("mode", next.mode);
      else params.delete("mode");
      if (next.q) params.set("q", next.q);
      else params.delete("q");
      if (next.sort !== "newest") params.set("sort", next.sort);
      else params.delete("sort");

      const optionalKeys: Array<keyof WorkspaceQueryState> = [
        "important",
        "contractType",
        "jobType",
        "rateUnit",
        "dateFrom",
        "dateTo",
      ];

      optionalKeys.forEach((key) => {
        const value = next[key];
        if (value === undefined || value === null || value === "") {
          params.delete(key);
        } else {
          params.set(key, String(value));
        }
      });

      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams, workspaceQuery],
  );

  const loadLeads = useCallback(
    async (cursor?: string) => {
      const isMore = Boolean(cursor);
      if (isMore) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
      }

      try {
        const result = await fetchProfileLeads(
          profileId,
          toLeadListQuery(workspaceQuery, cursor),
        );

        setLeads((current) => (isMore ? [...current, ...result.items] : result.items));
        setNextCursor(result.nextCursor);
        setHasMore(result.hasMore);
        setLoadError(null);
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : "Failed to load leads");
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [profileId, workspaceQuery],
  );

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      void loadLeads();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [loadLeads]);

  useEffect(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    searchDebounceRef.current = setTimeout(() => {
      if (searchInput !== workspaceQuery.q) {
        updateQuery({ q: searchInput });
      }
    }, 300);

    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [searchInput, updateQuery, workspaceQuery.q]);

  const setSaveState = useCallback((leadId: string, state: "idle" | "saving" | "saved" | "error") => {
    setSaveStates((current) => ({ ...current, [leadId]: state }));
  }, []);

  const updateLeadLocal = useCallback((leadId: string, patch: Partial<LeadTableRow>) => {
    setLeads((current) =>
      current.map((lead) => (lead.id === leadId ? { ...lead, ...patch } : lead)),
    );
  }, []);

  const persistLeadPatch = useCallback(
    async (leadId: string, patch: Record<string, unknown>, immediate = false) => {
      const run = async (version: number) => {
        setSaveState(leadId, "saving");

        try {
          const updated = await patchLead(leadId, patch);
          if (mutationQueue.current.isStale(leadId, version)) {
            return;
          }

          setLeads((current) =>
            current.map((lead) => (lead.id === leadId ? updated : lead)),
          );
          setSaveState(leadId, "saved");
          window.setTimeout(() => {
            setSaveState(leadId, "idle");
          }, 1200);
        } catch (error) {
          setSaveState(leadId, "error");
          throw error;
        }
      };

      if (immediate) {
        return mutationQueue.current.enqueue(leadId, run);
      }

      debouncer.current.schedule(leadId, () => {
        void mutationQueue.current.enqueue(leadId, run);
      });
    },
    [setSaveState],
  );

  const commitDraftRow = useCallback(
    async (draft = draftRow) => {
      if (!canCreateLeads) {
        return;
      }

      const companyName = draft.companyName.trim();
      const jobUrl = draft.jobUrl.trim();

      if (!companyName || !jobUrl) {
        return;
      }

      const tempId = `temp-${crypto.randomUUID()}`;
      const optimisticLead: LeadTableRow = {
        id: tempId,
        companyName,
        jobTitle: draft.jobTitle.trim() || undefined,
        jobUrl,
        rateAmount: draft.rateAmount ? Number(draft.rateAmount) : undefined,
        rateUnit: (draft.rateUnit || sessionDefaults.rateUnit || undefined) as LeadTableRow["rateUnit"],
        contractType: (draft.contractType ||
          sessionDefaults.contractType ||
          undefined) as LeadTableRow["contractType"],
        jobType: (draft.jobType || sessionDefaults.jobType || undefined) as LeadTableRow["jobType"],
        status: "APPLIED",
        isImportant: false,
        appliedDate: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        roundCount: 0,
      };

      setLeads((current) => [optimisticLead, ...current]);
      setDraftRow(createDraftRow());
      setSaveState(tempId, "saving");

      try {
        const result = await createProfileLead(profileId, {
          companyName,
          jobUrl,
          jobTitle: optimisticLead.jobTitle,
          rateAmount: optimisticLead.rateAmount,
          rateUnit: optimisticLead.rateUnit,
          contractType: optimisticLead.contractType,
          jobType: optimisticLead.jobType,
        });

        setLeads((current) =>
          current.map((lead) => (lead.id === tempId ? result.lead : lead)),
        );
        setSaveState(result.lead.id, "saved");

        if (result.warnings[0]) {
          setWarnings((current) => ({
            ...current,
            [result.lead.id]: result.warnings[0].message,
          }));
        }

        setSessionDefaults({
          rateUnit: result.lead.rateUnit ?? sessionDefaults.rateUnit,
          contractType: result.lead.contractType ?? sessionDefaults.contractType,
          jobType: result.lead.jobType ?? sessionDefaults.jobType,
        });
      } catch (error) {
        setSaveState(tempId, "error");
        setLoadError(error instanceof Error ? error.message : "Failed to create lead");
      }
    },
    [canCreateLeads, draftRow, profileId, sessionDefaults, setSaveState],
  );

  const handleBulkPaste = useCallback(
    async (rows: ReturnType<typeof parseBulkPaste>) => {
      if (!canCreateLeads) {
        return;
      }

      for (const row of rows) {
        await commitDraftRow({
          ...createDraftRow(),
          companyName: row.companyName,
          jobTitle: row.jobTitle ?? "",
          jobUrl: row.jobUrl,
        });
      }
    },
    [canCreateLeads, commitDraftRow],
  );

  const retrySave = useCallback(
    (leadId: string) => {
      const lead = leads.find((item) => item.id === leadId);
      if (!lead) {
        return;
      }

      if (leadId.startsWith("temp-")) {
        void commitDraftRow({
          ...createDraftRow(),
          companyName: lead.companyName,
          jobTitle: lead.jobTitle ?? "",
          jobUrl: lead.jobUrl,
          rateAmount: lead.rateAmount ? String(lead.rateAmount) : "",
          rateUnit: lead.rateUnit ?? "",
          contractType: lead.contractType ?? "",
          jobType: lead.jobType ?? "",
        });
        setLeads((current) => current.filter((item) => item.id !== leadId));
        return;
      }

      void persistLeadPatch(
        leadId,
        {
          companyName: lead.companyName,
          jobTitle: lead.jobTitle ?? null,
          jobUrl: lead.jobUrl,
          rateAmount: lead.rateAmount ?? null,
          rateUnit: lead.rateUnit ?? null,
          contractType: lead.contractType ?? null,
          jobType: lead.jobType ?? null,
          status: lead.status,
          isImportant: lead.isImportant,
          deadReason: lead.deadReason ?? null,
        },
        true,
      );
    },
    [commitDraftRow, leads, persistLeadPatch],
  );

  return {
    leads,
    draftRow,
    setDraftRow,
    workspaceQuery,
    searchInput,
    setSearchInput,
    updateQuery,
    isLoading,
    isLoadingMore,
    loadError,
    hasMore,
    saveStates,
    warnings,
    canCreateLeads,
    loadMore: () => {
      if (nextCursor && !isLoadingMore) {
        void loadLeads(nextCursor);
      }
    },
    reload: () => void loadLeads(),
    commitDraftRow,
    handleBulkPaste,
    updateLeadLocal,
    persistLeadPatch,
    retrySave,
    sessionDefaults,
    clearWarning: (leadId: string) => {
      setWarnings((current) => {
        const next = { ...current };
        delete next[leadId];
        return next;
      });
    },
  };
}
