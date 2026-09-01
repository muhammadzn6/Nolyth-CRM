import type { LeadTableRow } from "@/types/lead-table";

type LeadLike = {
  _id: { toString(): string };
  companyName: string;
  jobTitle?: string | null;
  jobUrl: string;
  rateAmount?: number | null;
  rateUnit?: LeadTableRow["rateUnit"] | null;
  contractType?: LeadTableRow["contractType"] | null;
  jobType?: LeadTableRow["jobType"] | null;
  status: LeadTableRow["status"];
  deadReason?: LeadTableRow["deadReason"] | null;
  deadNotes?: string | null;
  isImportant: boolean;
  appliedDate: Date;
  updatedAt: Date;
  roundCount?: number;
};

export function toLeadTableRow(lead: LeadLike): LeadTableRow {
  return {
    id: lead._id.toString(),
    companyName: lead.companyName,
    jobTitle: lead.jobTitle ?? undefined,
    jobUrl: lead.jobUrl,
    rateAmount: lead.rateAmount ?? undefined,
    rateUnit: lead.rateUnit ?? undefined,
    contractType: lead.contractType ?? undefined,
    jobType: lead.jobType ?? undefined,
    status: lead.status,
    deadReason: lead.deadReason ?? undefined,
    deadNotes: lead.deadNotes ?? undefined,
    isImportant: lead.isImportant,
    appliedDate: lead.appliedDate.toISOString(),
    updatedAt: lead.updatedAt.toISOString(),
    roundCount: lead.roundCount ?? 0,
  };
}
