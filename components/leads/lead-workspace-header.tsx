"use client";

import { Button, ButtonGroup, Tabs, Tooltip } from "@heroui/react";
import { Info } from "lucide-react";

import { SearchField } from "@/components/ui/search-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { CONTRACT_TYPES, JOB_TYPES, RATE_UNITS } from "@/constants/leads";
import { profilePossessiveTitle } from "@/lib/utils/profile-title";

import { LEAD_WORKSPACE_VIEWS } from "@/components/leads/types";
import type { LeadWorkspaceMode, LeadWorkspaceSort, LeadWorkspaceView } from "@/components/leads/types";
import {
  CONTRACT_TYPE_LABELS,
  JOB_TYPE_LABELS,
  RATE_UNIT_LABELS,
} from "@/components/leads/types";

const SORT_OPTIONS: { value: LeadWorkspaceSort; label: string }[] = [
  { value: "newest", label: "Newest applied" },
  { value: "oldest", label: "Oldest applied" },
  { value: "company", label: "Company A-Z" },
  { value: "updated", label: "Last updated" },
  { value: "important", label: "Important" },
];

function ProfileDetailsTooltip({
  leadCount,
  assignedBd,
  assignedCloser,
}: {
  leadCount: number;
  assignedBd?: string;
  assignedCloser?: string;
}) {
  return (
    <Tooltip delay={0}>
      <Button
        isIconOnly
        variant="ghost"
        size="sm"
        aria-label="Profile details"
        className="shrink-0 text-muted hover:text-foreground"
      >
        <Info className="h-4 w-4" />
      </Button>
      <Tooltip.Content placement="bottom" showArrow className="px-3 py-2">
        <Tooltip.Arrow />
        <div className="space-y-1 text-sm">
          <p>{leadCount.toLocaleString()} leads</p>
          {assignedBd ? <p>BD: {assignedBd}</p> : null}
          {assignedCloser ? <p>Closer: {assignedCloser}</p> : null}
        </div>
      </Tooltip.Content>
    </Tooltip>
  );
}

export function LeadWorkspaceHeader({
  profileName,
  leadCount,
  assignedBd,
  assignedCloser,
  searchInput,
  sort,
  filters,
  onSearchChange,
  onSortChange,
  onFilterChange,
  mode,
  onModeChange,
}: {
  profileName: string;
  leadCount: number;
  assignedBd?: string;
  assignedCloser?: string;
  searchInput: string;
  sort: LeadWorkspaceSort;
  mode: LeadWorkspaceMode;
  filters: {
    contractType?: string;
    jobType?: string;
    rateUnit?: string;
    dateFrom?: string;
    dateTo?: string;
  };
  onSearchChange: (value: string) => void;
  onSortChange: (sort: LeadWorkspaceSort) => void;
  onFilterChange: (patch: Record<string, string | undefined>) => void;
  onModeChange: (mode: LeadWorkspaceMode) => void;
}) {
  return (
    <div className="space-y-4 pb-2">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2">
          <h1 className="orbit-heading truncate text-foreground">
            {profilePossessiveTitle(profileName)}
          </h1>
          <ProfileDetailsTooltip
            leadCount={leadCount}
            assignedBd={assignedBd}
            assignedCloser={assignedCloser}
          />
        </div>

        <ButtonGroup variant="secondary">
          <Button
            variant={mode === "table" ? "primary" : "tertiary"}
            onPress={() => onModeChange("table")}
          >
            Table
          </Button>
          <ButtonGroup.Separator />
          <Button
            variant={mode === "kanban" ? "primary" : "tertiary"}
            onPress={() => onModeChange("kanban")}
          >
            Kanban
          </Button>
        </ButtonGroup>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SearchField
          value={searchInput}
          onChange={onSearchChange}
          placeholder="Search company, title, URL, recruiter…"
          className="max-w-xl"
        />

        <Select
          value={sort}
          onChange={(value) => onSortChange(value as LeadWorkspaceSort)}
          options={SORT_OPTIONS}
          aria-label="Sort leads"
          className="w-[148px]"
        />

        <Select
          value={filters.contractType ?? ""}
          onChange={(value) => onFilterChange({ contractType: value || undefined })}
          options={[
            { value: "", label: "Contract" },
            ...CONTRACT_TYPES.map((type) => ({
              value: type,
              label: CONTRACT_TYPE_LABELS[type],
            })),
          ]}
          aria-label="Filter by contract type"
          className="w-[132px]"
        />

        <Select
          value={filters.jobType ?? ""}
          onChange={(value) => onFilterChange({ jobType: value || undefined })}
          options={[
            { value: "", label: "Job type" },
            ...JOB_TYPES.map((type) => ({
              value: type,
              label: JOB_TYPE_LABELS[type],
            })),
          ]}
          aria-label="Filter by job type"
          className="w-[132px]"
        />

        <Select
          value={filters.rateUnit ?? ""}
          onChange={(value) => onFilterChange({ rateUnit: value || undefined })}
          options={[
            { value: "", label: "Rate unit" },
            ...RATE_UNITS.map((unit) => ({
              value: unit,
              label: RATE_UNIT_LABELS[unit],
            })),
          ]}
          aria-label="Filter by rate unit"
          className="w-[120px]"
        />

        <Input
          type="date"
          value={filters.dateFrom ?? ""}
          onChange={(event) => onFilterChange({ dateFrom: event.target.value || undefined })}
          aria-label="Applied from"
          className="w-[148px]"
        />
        <Input
          type="date"
          value={filters.dateTo ?? ""}
          onChange={(event) => onFilterChange({ dateTo: event.target.value || undefined })}
          aria-label="Applied to"
          className="w-[148px]"
        />
      </div>
    </div>
  );
}

export function LeadStatusTabs({
  activeView,
  onChange,
}: {
  activeView: LeadWorkspaceView;
  onChange: (view: LeadWorkspaceView) => void;
}) {
  return (
    <Tabs
      variant="secondary"
      selectedKey={activeView}
      onSelectionChange={(key) => onChange(String(key) as LeadWorkspaceView)}
      className="w-full"
    >
      <Tabs.ListContainer>
        <Tabs.List aria-label="Lead views">
          {LEAD_WORKSPACE_VIEWS.map((view) => (
            <Tabs.Tab key={view.id} id={view.id}>
              {view.label}
              <Tabs.Indicator />
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs.ListContainer>
    </Tabs>
  );
}
