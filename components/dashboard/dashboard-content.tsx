"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "framer-motion";
import {
  CalendarClock,
  ChevronRight,
  Flag,
  Star,
  Target,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  INTERVIEW_ROUND_TYPE_LABELS,
  STATUS_LABELS,
} from "@/components/leads/types";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { formatAverageRate, formatDateTime } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import type { RateUnit } from "@/constants/leads";
import type { DashboardData, DashboardJobStats } from "@/types/dashboard";

const STATUS_COLORS = {
  APPLIED: "var(--chart-applied)",
  IN_PROCESS: "var(--chart-in-process)",
  FINAL_ROUND: "var(--chart-final-round)",
  CLOSED: "var(--chart-closed)",
  DEAD: "var(--chart-dead)",
} as const;

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.055,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.24, ease: "easeOut" as const },
  },
};

function MetricCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof Target;
}) {
  return (
    <motion.div variants={itemVariants}>
      <Card className="h-full shadow-none">
        <CardBody className="flex items-start justify-between gap-4 p-4">
          <div>
            <p className="text-sm font-medium text-muted">
              {label}
            </p>
            <p className="mt-1 text-3xl font-semibold tracking-tight text-foreground">
              {value.toLocaleString()}
            </p>
          </div>
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
        </CardBody>
      </Card>
    </motion.div>
  );
}

function SectionHeading({ title }: { title: string }) {
  return (
    <h2 className="text-sm font-semibold text-foreground">{title}</h2>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value?: number; payload?: { label?: string } }>;
  label?: string;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="rounded-xl bg-overlay px-3 py-2 shadow-overlay">
      <p className="text-xs text-muted">
        {payload[0]?.payload?.label ?? label}
      </p>
      <p className="text-sm font-semibold text-foreground">
        {(payload[0]?.value ?? 0).toLocaleString()} leads
      </p>
    </div>
  );
}

function EmptySection({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-44 flex-col items-center justify-center px-6 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 max-w-sm text-xs text-muted">
        {description}
      </p>
    </div>
  );
}

function RateUnitToggle({
  value,
  onChange,
}: {
  value: RateUnit;
  onChange: (value: RateUnit) => void;
}) {
  return (
    <div className="inline-flex rounded-xl bg-default/40 p-1">
      {(["HOURLY", "YEARLY"] as const).map((unit) => (
        <button
          key={unit}
          type="button"
          onClick={() => onChange(unit)}
          className={cn(
            "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
            value === unit
              ? "bg-accent text-accent-foreground"
              : "text-muted hover:text-foreground",
          )}
        >
          {unit === "HOURLY" ? "Per hour" : "Per year"}
        </button>
      ))}
    </div>
  );
}

function JobStatsCard({ jobStats }: { jobStats: DashboardJobStats }) {
  const [rateView, setRateView] = useState<RateUnit>("HOURLY");
  const averageRate =
    rateView === "HOURLY" ? jobStats.averageRateHourly : jobStats.averageRateYearly;
  const hasRatedJobs = jobStats.ratedJobCount > 0;

  return (
    <Card className="h-full shadow-none">
      <CardHeader className="flex items-center justify-between gap-4 px-5 py-4">
        <SectionHeading title="Job stats" />
        <RateUnitToggle value={rateView} onChange={setRateView} />
      </CardHeader>
      <CardBody className="px-5 pb-5">
        {hasRatedJobs ? (
          <div className="flex flex-col items-center">
            <div className="relative h-[240px] w-full max-w-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart accessibilityLayer>
                  <Pie
                    data={[{ value: 1 }]}
                    dataKey="value"
                    innerRadius="72%"
                    outerRadius="92%"
                    stroke="transparent"
                    fill="var(--accent)"
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
                <p className="text-2xl font-semibold tracking-tight text-accent sm:text-3xl">
                  {formatAverageRate(averageRate, rateView)}
                </p>
                <p className="mt-1 text-xs text-muted">Average rate</p>
              </div>
            </div>
            <p className="mt-2 max-w-sm text-center text-[11px] leading-5 text-muted">
              Across {jobStats.ratedJobCount} rated jobs, including converted{" "}
              {rateView === "HOURLY" ? "hourly" : "yearly"} equivalents
            </p>
          </div>
        ) : (
          <EmptySection
            title="No rate data yet"
            description="Add hourly or yearly rates to jobs to calculate averages."
          />
        )}
      </CardBody>
    </Card>
  );
}

export function DashboardContent({ data }: { data: DashboardData }) {
  const statusChartData = data.statusDistribution.map((item) => ({
    ...item,
    label: STATUS_LABELS[item.status],
  }));
  const hasPipelineData = statusChartData.some((item) => item.count > 0);
  const hasTrendData = data.applicationTrend.some((item) => item.count > 0);

  return (
    <motion.div
      className="space-y-5"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Active pipeline"
          value={data.metrics.activePipeline}
          icon={Target}
        />
        <MetricCard
          label="Final round"
          value={data.metrics.finalRound}
          icon={Flag}
        />
        <MetricCard
          label="Important leads"
          value={data.metrics.importantActive}
          icon={Star}
        />
        <MetricCard
          label="Next 7 days"
          value={data.metrics.upcomingInterviews}
          icon={CalendarClock}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <motion.div variants={itemVariants}>
          <Card className="h-full shadow-none">
            <CardHeader className="px-5 py-4">
              <SectionHeading title="Pipeline distribution" />
            </CardHeader>
            <CardBody className="h-[290px] px-3 py-4 sm:px-5">
              {hasPipelineData ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={statusChartData}
                    layout="vertical"
                    margin={{ top: 2, right: 16, bottom: 2, left: 4 }}
                    accessibilityLayer
                  >
                    <CartesianGrid
                      horizontal={false}
                      stroke="var(--color-border)"
                      strokeDasharray="3 3"
                    />
                    <XAxis
                      type="number"
                      allowDecimals={false}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "var(--color-text-muted)", fontSize: 11 }}
                    />
                    <YAxis
                      type="category"
                      dataKey="label"
                      width={82}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "var(--color-text-muted)", fontSize: 11 }}
                    />
                    <Tooltip
                      content={<ChartTooltip />}
                      cursor={{ fill: "var(--color-accent-soft)", opacity: 0.55 }}
                    />
                    <Bar dataKey="count" radius={[0, 5, 5, 0]} maxBarSize={24}>
                      {statusChartData.map((item) => (
                        <Cell
                          key={item.status}
                          fill={STATUS_COLORS[item.status]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptySection
                  title="No pipeline data yet"
                  description="Lead status distribution will appear after the first lead is added."
                />
              )}
            </CardBody>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="h-full shadow-none">
            <CardHeader className="px-5 py-4">
              <SectionHeading title="Application momentum" />
            </CardHeader>
            <CardBody className="h-[290px] px-3 py-4 sm:px-5">
              {hasTrendData ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.applicationTrend}
                    margin={{ top: 8, right: 8, bottom: 0, left: -18 }}
                    accessibilityLayer
                  >
                    <CartesianGrid
                      vertical={false}
                      stroke="var(--color-border)"
                      strokeDasharray="3 3"
                    />
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "var(--color-text-muted)", fontSize: 11 }}
                    />
                    <YAxis
                      allowDecimals={false}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "var(--color-text-muted)", fontSize: 11 }}
                    />
                    <Tooltip
                      content={<ChartTooltip />}
                      cursor={{ fill: "var(--color-accent-soft)", opacity: 0.55 }}
                    />
                    <Bar
                      dataKey="count"
                      fill="var(--color-accent)"
                      radius={[5, 5, 0, 0]}
                      maxBarSize={32}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptySection
                  title="No recent applications"
                  description="Weekly momentum will appear as applications are added."
                />
              )}
            </CardBody>
          </Card>
        </motion.div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <motion.div variants={itemVariants}>
          <JobStatsCard jobStats={data.jobStats} />
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="h-full shadow-none">
            <CardHeader className="flex items-center justify-between gap-4 px-5 py-4">
              <SectionHeading title="Upcoming interviews" />
              <CalendarClock
                className="h-4 w-4 text-accent"
                aria-hidden="true"
              />
            </CardHeader>
            {data.upcomingInterviews.length ? (
              <div className="space-y-px">
                {data.upcomingInterviews.map((interview) => (
                  <Link
                    key={interview.id}
                    href={`/profiles/${interview.profileId}/leads/${interview.leadId}?return=`}
                    className="group flex items-center gap-3 rounded-xl px-5 py-3.5 hover:bg-surface-secondary"
                  >
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-xs font-semibold text-accent">
                      R{interview.roundNumber}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {interview.companyName}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-muted">
                        {INTERVIEW_ROUND_TYPE_LABELS[interview.roundType]} ·{" "}
                        {formatDateTime(interview.scheduledAt)}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-muted">
                      {interview.profileName}
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
                  </Link>
                ))}
              </div>
            ) : (
              <EmptySection
                title="No interviews scheduled"
                description="Scheduled or waiting rounds in the next 7 days will appear here."
              />
            )}
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}
