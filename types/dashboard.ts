import type { InterviewRoundType, LeadStatus } from "@/constants/leads";

export type DashboardStatusPoint = {
  status: LeadStatus;
  count: number;
};

export type DashboardApplicationPoint = {
  weekStart: string;
  label: string;
  count: number;
};

export type DashboardJobStatusStat = {
  status: LeadStatus;
  count: number;
  rate: number;
};

export type DashboardJobStats = {
  totalJobs: number;
  appliedCount: number;
  appliedRate: number;
  ratedJobCount: number;
  averageRateHourly: number | null;
  averageRateYearly: number | null;
  statusBreakdown: DashboardJobStatusStat[];
};

export type DashboardUpcomingInterview = {
  id: string;
  leadId: string;
  profileId: string;
  profileName: string;
  companyName: string;
  jobTitle?: string;
  roundNumber: number;
  roundType: InterviewRoundType;
  scheduledAt: string;
};

export type DashboardData = {
  scope: {
    profileCount: number;
    profileNames: string[];
  };
  metrics: {
    activePipeline: number;
    finalRound: number;
    importantActive: number;
    upcomingInterviews: number;
  };
  statusDistribution: DashboardStatusPoint[];
  applicationTrend: DashboardApplicationPoint[];
  jobStats: DashboardJobStats;
  upcomingInterviews: DashboardUpcomingInterview[];
  generatedAt: string;
};
