import { describe, expect, it } from "vitest";

import { rankLeaderboard } from "./leaderboard";

describe("rankLeaderboard", () => {
  it("applies score tie-breakers and gives every official BD a unique rank", () => {
    expect(rankLeaderboard([
      { bdId: "a", bdName: "Zara", rankable: true, balancedScore: 90, effectiveAttainmentPercent: 100, maturedOutcomeScorePercent: 70, followUpSlaCompliancePercent: 90 },
      { bdId: "b", bdName: "Ayesha", rankable: true, balancedScore: 90, effectiveAttainmentPercent: 110, maturedOutcomeScorePercent: 60, followUpSlaCompliancePercent: 90 },
      { bdId: "c", bdName: "Bruno", rankable: true, balancedScore: 90, effectiveAttainmentPercent: 110, maturedOutcomeScorePercent: 60, followUpSlaCompliancePercent: 95 },
      { bdId: "d", bdName: "Avery", rankable: true, balancedScore: 90, effectiveAttainmentPercent: 110, maturedOutcomeScorePercent: 60, followUpSlaCompliancePercent: 95 },
      { bdId: "e", bdName: "New BD", rankable: false, balancedScore: 99, effectiveAttainmentPercent: 200, maturedOutcomeScorePercent: 100, followUpSlaCompliancePercent: 100 },
    ])).toEqual([
      expect.objectContaining({ bdId: "d", rank: 1 }),
      expect.objectContaining({ bdId: "c", rank: 2 }),
      expect.objectContaining({ bdId: "b", rank: 3 }),
      expect.objectContaining({ bdId: "a", rank: 4 }),
      expect.objectContaining({ bdId: "e", rank: null }),
    ]);
  });
});
