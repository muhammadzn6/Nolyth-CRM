import type {
  ContractType,
  DeadReason,
  JobType,
  LeadStatus,
  RateUnit,
} from "@/constants/leads";

export type LeadTableRow = {
  id: string;
  companyName: string;
  jobTitle?: string;
  jobUrl: string;
  rateAmount?: number;
  rateUnit?: RateUnit;
  contractType?: ContractType;
  jobType?: JobType;
  status: LeadStatus;
  deadReason?: DeadReason;
  deadNotes?: string;
  isImportant: boolean;
  appliedDate: string;
  updatedAt: string;
  roundCount: number;
};

export type LeadListResult = {
  items: LeadTableRow[];
  nextCursor: string | null;
  hasMore: boolean;
};

export type LeadDuplicateWarning = {
  code: "DUPLICATE_URL";
  message: string;
  existingLeadId: string;
  existingCompanyName: string;
  existingAppliedDate: string;
};

export type CreateLeadResult = {
  lead: LeadTableRow;
  warnings: LeadDuplicateWarning[];
};
