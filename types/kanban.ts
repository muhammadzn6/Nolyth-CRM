import type { LeadStatus } from "@/constants/leads";
import type { LeadTableRow } from "@/types/lead-table";

export type KanbanCard = Pick<
  LeadTableRow,
  | "id"
  | "companyName"
  | "jobTitle"
  | "jobUrl"
  | "rateAmount"
  | "rateUnit"
  | "contractType"
  | "jobType"
  | "status"
  | "isImportant"
  | "updatedAt"
  | "roundCount"
>;

export type KanbanColumnResult = {
  items: KanbanCard[];
  nextCursor: string | null;
  hasMore: boolean;
};

export type KanbanBoardResult = {
  counts: Record<LeadStatus, number>;
  columns: Record<LeadStatus, KanbanColumnResult>;
};
