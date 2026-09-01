import mongoose from "mongoose";

import type { RateUnit } from "@/constants/leads";
import { LEAD_STATUSES, type LeadStatus } from "@/constants/leads";
import { connectToDatabase } from "@/lib/db/mongoose";
import { calculateAverageRate } from "@/lib/leads/rate-conversion";
import { InterviewRoundModel } from "@/models/interview-round";
import { JobLeadModel } from "@/models/job-lead";
import type { AppActor } from "@/types/auth";
import type {
  DashboardApplicationPoint,
  DashboardData,
  DashboardJobStats,
  DashboardUpcomingInterview,
} from "@/types/dashboard";

import { listAccessibleProfiles } from "@/services/profile-service";

const ACTIVE_STATUSES: LeadStatus[] = ["APPLIED", "IN_PROCESS", "FINAL_ROUND"];
const TREND_WEEK_COUNT = 8;
const UPCOMING_LIMIT = 6;
const UPCOMING_DAYS = 7;

type StatusCount = {
  _id: LeadStatus;
  count: number;
};

type TrendCount = {
  _id: Date;
  count: number;
};

type LeadFacetResult = {
  byStatus: StatusCount[];
  trend: TrendCount[];
  importantActive: Array<{ count: number }>;
  rates: Array<{ rateAmount: number; rateUnit: RateUnit }>;
};

function startOfUtcWeek(value: Date) {
  const start = new Date(value);
  start.setUTCHours(0, 0, 0, 0);
  const daysSinceMonday = (start.getUTCDay() + 6) % 7;
  start.setUTCDate(start.getUTCDate() - daysSinceMonday);
  return start;
}

function addUtcDays(value: Date, days: number) {
  const result = new Date(value);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function buildApplicationTrend(
  trendStart: Date,
  counts: TrendCount[],
): DashboardApplicationPoint[] {
  const countsByWeek = new Map(
    counts.map((item) => [startOfUtcWeek(new Date(item._id)).toISOString(), item.count]),
  );

  return Array.from({ length: TREND_WEEK_COUNT }, (_, index) => {
    const weekStart = addUtcDays(trendStart, index * 7);
    return {
      weekStart: weekStart.toISOString(),
      label: new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      }).format(weekStart),
      count: countsByWeek.get(weekStart.toISOString()) ?? 0,
    };
  });
}

function buildJobStats(
  statusDistribution: Array<{ status: LeadStatus; count: number }>,
  rates: Array<{ rateAmount: number; rateUnit: RateUnit }>,
): DashboardJobStats {
  const totalJobs = statusDistribution.reduce((sum, item) => sum + item.count, 0);
  const statusBreakdown = statusDistribution.map((item) => ({
    status: item.status,
    count: item.count,
    rate: totalJobs === 0 ? 0 : Math.round((item.count / totalJobs) * 1000) / 10,
  }));
  const applied = statusBreakdown.find((item) => item.status === "APPLIED");

  return {
    totalJobs,
    appliedCount: applied?.count ?? 0,
    appliedRate: applied?.rate ?? 0,
    ratedJobCount: rates.length,
    averageRateHourly: calculateAverageRate(rates, "HOURLY"),
    averageRateYearly: calculateAverageRate(rates, "YEARLY"),
    statusBreakdown,
  };
}

function createEmptyDashboard(
  profileNames: string[],
  now: Date,
): DashboardData {
  const currentWeekStart = startOfUtcWeek(now);
  const trendStart = addUtcDays(currentWeekStart, -(TREND_WEEK_COUNT - 1) * 7);

  return {
    scope: {
      profileCount: profileNames.length,
      profileNames,
    },
    metrics: {
      activePipeline: 0,
      finalRound: 0,
      importantActive: 0,
      upcomingInterviews: 0,
    },
    statusDistribution: LEAD_STATUSES.map((status) => ({ status, count: 0 })),
    applicationTrend: buildApplicationTrend(trendStart, []),
    jobStats: buildJobStats(
      LEAD_STATUSES.map((status) => ({ status, count: 0 })),
      [],
    ),
    upcomingInterviews: [],
    generatedAt: now.toISOString(),
  };
}

export async function getDashboardData(
  actor: AppActor,
  now = new Date(),
): Promise<DashboardData> {
  await connectToDatabase();

  const profiles = await listAccessibleProfiles(actor);
  const profileNames = profiles.map((profile) => profile.name);
  const profileIds = profiles.map(
    (profile) => new mongoose.Types.ObjectId(profile._id.toString()),
  );

  if (profileIds.length === 0) {
    return createEmptyDashboard(profileNames, now);
  }

  const profileNameById = new Map(
    profiles.map((profile) => [profile._id.toString(), profile.name]),
  );
  const currentWeekStart = startOfUtcWeek(now);
  const trendStart = addUtcDays(currentWeekStart, -(TREND_WEEK_COUNT - 1) * 7);
  const upcomingEnd = addUtcDays(now, UPCOMING_DAYS);
  const profileMatch = { $in: profileIds };

  const [leadFacetRows, upcomingRounds, upcomingInterviewCount] = await Promise.all([
    JobLeadModel.aggregate<LeadFacetResult>([
      { $match: { profileId: profileMatch } },
      {
        $facet: {
          byStatus: [{ $group: { _id: "$status", count: { $sum: 1 } } }],
          trend: [
            { $match: { appliedDate: { $gte: trendStart, $lte: now } } },
            {
              $group: {
                _id: {
                  $dateTrunc: {
                    date: "$appliedDate",
                    unit: "week",
                    startOfWeek: "monday",
                    timezone: "UTC",
                  },
                },
                count: { $sum: 1 },
              },
            },
            { $sort: { _id: 1 } },
          ],
          importantActive: [
            {
              $match: {
                status: { $in: ACTIVE_STATUSES },
                isImportant: true,
              },
            },
            { $count: "count" },
          ],
          rates: [
            {
              $match: {
                rateAmount: { $ne: null, $gt: 0 },
                rateUnit: { $in: ["HOURLY", "YEARLY"] },
              },
            },
            { $project: { _id: 0, rateAmount: 1, rateUnit: 1 } },
          ],
        },
      },
    ]),
    InterviewRoundModel.find({
      profileId: profileMatch,
      scheduledAt: { $gte: now, $lte: upcomingEnd },
      result: { $in: ["SCHEDULED", "WAITING"] },
    })
      .select("leadId profileId roundNumber roundType scheduledAt")
      .sort({ scheduledAt: 1, _id: 1 })
      .limit(UPCOMING_LIMIT)
      .lean(),
    InterviewRoundModel.countDocuments({
      profileId: profileMatch,
      scheduledAt: { $gte: now, $lte: upcomingEnd },
      result: { $in: ["SCHEDULED", "WAITING"] },
    }),
  ]);

  const facet = leadFacetRows[0] ?? {
    byStatus: [],
    trend: [],
    importantActive: [],
    rates: [],
  };
  const statusCounts = new Map(
    facet.byStatus.map((item) => [item._id, item.count]),
  );

  const upcomingLeadIds = [
    ...new Set(upcomingRounds.map((round) => round.leadId.toString())),
  ];
  const upcomingLeads = upcomingLeadIds.length
    ? await JobLeadModel.find({ _id: { $in: upcomingLeadIds } })
        .select("companyName jobTitle")
        .lean()
    : [];
  const upcomingLeadById = new Map(
    upcomingLeads.map((lead) => [lead._id.toString(), lead]),
  );

  const upcomingInterviews: DashboardUpcomingInterview[] = upcomingRounds
    .map((round): DashboardUpcomingInterview | null => {
      const lead = upcomingLeadById.get(round.leadId.toString());
      if (!lead || !round.scheduledAt) {
        return null;
      }

      return {
        id: round._id.toString(),
        leadId: round.leadId.toString(),
        profileId: round.profileId.toString(),
        profileName:
          profileNameById.get(round.profileId.toString()) ?? "Unknown profile",
        companyName: lead.companyName,
        jobTitle: lead.jobTitle ?? undefined,
        roundNumber: round.roundNumber,
        roundType: round.roundType,
        scheduledAt: round.scheduledAt.toISOString(),
      };
    })
    .filter(
      (item): item is DashboardUpcomingInterview => item !== null,
    );

  const statusDistribution = LEAD_STATUSES.map((status) => ({
    status,
    count: statusCounts.get(status) ?? 0,
  }));
  const activePipeline = ACTIVE_STATUSES.reduce(
    (total, status) => total + (statusCounts.get(status) ?? 0),
    0,
  );

  return {
    scope: {
      profileCount: profiles.length,
      profileNames,
    },
    metrics: {
      activePipeline,
      finalRound: statusCounts.get("FINAL_ROUND") ?? 0,
      importantActive: facet.importantActive[0]?.count ?? 0,
      upcomingInterviews: upcomingInterviewCount,
    },
    statusDistribution,
    applicationTrend: buildApplicationTrend(trendStart, facet.trend),
    jobStats: buildJobStats(statusDistribution, facet.rates),
    upcomingInterviews,
    generatedAt: now.toISOString(),
  };
}
