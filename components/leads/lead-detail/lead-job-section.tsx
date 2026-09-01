"use client";

import type { ReactNode } from "react";

import {
  CONTRACT_TYPE_LABELS,
  JOB_TYPE_LABELS,
  RATE_UNIT_LABELS,
} from "@/components/leads/types";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { TextArea } from "@/components/ui/textarea";
import { CONTRACT_TYPES, JOB_TYPES, RATE_UNITS } from "@/constants/leads";
import type { LeadDetail } from "@/types/lead-detail";

const RATE_UNIT_OPTIONS = [
  { value: "", label: "—" },
  ...RATE_UNITS.map((unit) => ({ value: unit, label: RATE_UNIT_LABELS[unit] })),
];

const CONTRACT_OPTIONS = [
  { value: "", label: "—" },
  ...CONTRACT_TYPES.map((type) => ({ value: type, label: CONTRACT_TYPE_LABELS[type] })),
];

const JOB_TYPE_OPTIONS = [
  { value: "", label: "—" },
  ...JOB_TYPES.map((type) => ({ value: type, label: JOB_TYPE_LABELS[type] })),
];

export function LeadJobSection({
  lead,
  canEdit,
  onPatch,
}: {
  lead: LeadDetail;
  canEdit: boolean;
  onPatch: (patch: Record<string, unknown>) => void;
}) {
  return (
    <section className="space-y-4">
      <h2 className="orbit-muted-label">Job information</h2>

      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Company">
          <Input
            defaultValue={lead.companyName}
            disabled={!canEdit}
            onBlur={(event) => onPatch({ companyName: event.target.value })}
          />
        </Field>
        <Field label="Job title">
          <Input
            defaultValue={lead.jobTitle ?? ""}
            disabled={!canEdit}
            onBlur={(event) => onPatch({ jobTitle: event.target.value || null })}
          />
        </Field>
        <Field label="Job URL">
          <Input
            defaultValue={lead.jobUrl}
            disabled={!canEdit}
            onBlur={(event) => onPatch({ jobUrl: event.target.value })}
          />
        </Field>
        <Field label="Rate">
          <Input
            type="number"
            defaultValue={lead.rateAmount ?? ""}
            disabled={!canEdit}
            onBlur={(event) =>
              onPatch({ rateAmount: event.target.value ? Number(event.target.value) : null })
            }
          />
        </Field>
        <Field label="Rate unit">
          <Select
            value={lead.rateUnit ?? ""}
            disabled={!canEdit}
            onChange={(value) => onPatch({ rateUnit: value || null })}
            options={RATE_UNIT_OPTIONS}
          />
        </Field>
        <Field label="Contract type">
          <Select
            value={lead.contractType ?? ""}
            disabled={!canEdit}
            onChange={(value) => onPatch({ contractType: value || null })}
            options={CONTRACT_OPTIONS}
          />
        </Field>
        <Field label="Job type">
          <Select
            value={lead.jobType ?? ""}
            disabled={!canEdit}
            onChange={(value) => onPatch({ jobType: value || null })}
            options={JOB_TYPE_OPTIONS}
          />
        </Field>
        <Field label="Recruiter name">
          <Input
            defaultValue={lead.recruiterName ?? ""}
            disabled={!canEdit}
            onBlur={(event) => onPatch({ recruiterName: event.target.value || null })}
          />
        </Field>
        <Field label="Recruiter contact">
          <Input
            defaultValue={lead.recruiterContact ?? ""}
            disabled={!canEdit}
            onBlur={(event) => onPatch({ recruiterContact: event.target.value || null })}
          />
        </Field>
      </div>

      <Field label="Job description">
        <TextArea
          defaultValue={lead.jobDescription ?? ""}
          disabled={!canEdit}
          rows={6}
          onBlur={(event) => onPatch({ jobDescription: event.target.value || null })}
        />
      </Field>
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5 text-sm">
      <span className="text-muted">{label}</span>
      {children}
    </label>
  );
}
