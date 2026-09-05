export type LeaderboardRowInput = {
  bdId: string;
  bdName: string;
  rankable: boolean;
  balancedScore: number | null;
  effectiveAttainmentPercent: number | null;
  maturedOutcomeScorePercent: number | null;
  followUpSlaCompliancePercent: number | null;
};

export type RankedLeaderboardRow = LeaderboardRowInput & { rank: number | null };

function descending(left: number | null, right: number | null): number {
  return (right ?? Number.NEGATIVE_INFINITY) - (left ?? Number.NEGATIVE_INFINITY);
}

function compareRows(left: LeaderboardRowInput, right: LeaderboardRowInput): number {
  return descending(left.balancedScore, right.balancedScore)
    || descending(left.effectiveAttainmentPercent, right.effectiveAttainmentPercent)
    || descending(left.maturedOutcomeScorePercent, right.maturedOutcomeScorePercent)
    || descending(left.followUpSlaCompliancePercent, right.followUpSlaCompliancePercent)
    || left.bdName.localeCompare(right.bdName, undefined, { sensitivity: "base" })
    || left.bdId.localeCompare(right.bdId);
}

/** Returns official rows in score order followed by unranked Building Baseline rows. */
export function rankLeaderboard(rows: readonly LeaderboardRowInput[]): RankedLeaderboardRow[] {
  const official = rows.filter((row) => row.rankable && row.balancedScore !== null).sort(compareRows)
    .map((row, index) => ({ ...row, rank: index + 1 }));
  const baseline = rows.filter((row) => !row.rankable || row.balancedScore === null).sort(compareRows)
    .map((row) => ({ ...row, rank: null }));
  return [...official, ...baseline];
}
