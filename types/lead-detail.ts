import type { LeadTableRow } from "@/types/lead-table";

export type LeadDetail = LeadTableRow & {
  profileId: string;
  jobDescription?: string;
  recruiterName?: string;
  recruiterContact?: string;
};
