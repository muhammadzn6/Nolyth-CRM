type ResponseTransition = { lead?: { appliedDate?: Date | string | null }; occurredAt?: Date | string | null };
type InterviewRoundMetric = { leadId?: unknown; status?: unknown; attendance?: unknown };
const actionableUpcomingStatuses = new Set(["SCHEDULED", "RESCHEDULE_REQUIRED"]);

export function isActionableUpcomingInterview(row: { status?: unknown; startsAt?: unknown }, now: Date) {
  return actionableUpcomingStatuses.has(String(row.status))
    && row.startsAt instanceof Date
    && row.startsAt > now;
}

export function averageResponseTimeHours(rows: readonly ResponseTransition[]): number | null {
  const hours = rows.flatMap((row) => {
    if (!row.lead?.appliedDate || !row.occurredAt) return [];
    const elapsed = (new Date(row.occurredAt).getTime() - new Date(row.lead.appliedDate).getTime()) / 3_600_000;
    return elapsed >= 0 ? [elapsed] : [];
  });
  if (!hours.length) return null;
  return Math.round((hours.reduce((total, value) => total + value, 0) / hours.length) * 10) / 10;
}

export function summarizeInterviewRounds(rows: readonly InterviewRoundMetric[]) {
  const activeRounds = rows.filter((row) => String(row.status) !== "CANCELLED");
  const interviewLeads = new Set(activeRounds.map((row) => String(row.leadId))).size;
  const attendedRounds = activeRounds.filter((row) => row.attendance === "ATTENDED").length;

  return {
    interviewLeads,
    interviewRounds: activeRounds.length,
    attendedRounds,
    cancelledRounds: rows.length - activeRounds.length,
    averageRoundsPerInterviewLead: interviewLeads > 0 ? activeRounds.length / interviewLeads : null,
    roundAttendanceRate: activeRounds.length > 0 ? attendedRounds / activeRounds.length : null,
  };
}
