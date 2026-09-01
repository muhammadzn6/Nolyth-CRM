import { toLeadTableRow } from "@/lib/leads/to-table-row";
import { connectToDatabase } from "@/lib/db/mongoose";
import { InterviewRoundModel } from "@/models/interview-round";
import type { AppActor } from "@/types/auth";
import type { LeadDetail } from "@/types/lead-detail";

import { getLeadById } from "@/services/lead-service";

export async function getLeadDetail(leadId: string, actor: AppActor): Promise<LeadDetail> {
  await connectToDatabase();
  const lead = await getLeadById(leadId, actor);

  const roundCount = await InterviewRoundModel.countDocuments({ leadId: lead._id });

  const tableRow = toLeadTableRow({
    _id: lead._id,
    companyName: lead.companyName,
    jobTitle: lead.jobTitle,
    jobUrl: lead.jobUrl,
    rateAmount: lead.rateAmount,
    rateUnit: lead.rateUnit,
    contractType: lead.contractType,
    jobType: lead.jobType,
    status: lead.status,
    deadReason: lead.deadReason,
    deadNotes: lead.deadNotes,
    isImportant: lead.isImportant,
    appliedDate: lead.appliedDate,
    updatedAt: lead.updatedAt,
    roundCount,
  });

  return {
    ...tableRow,
    profileId: lead.profileId.toString(),
    jobDescription: lead.jobDescription ?? undefined,
    recruiterName: lead.recruiterName ?? undefined,
    recruiterContact: lead.recruiterContact ?? undefined,
  };
}
