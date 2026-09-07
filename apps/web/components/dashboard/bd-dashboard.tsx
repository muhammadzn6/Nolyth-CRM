import type { BdPerformanceResponse, BdWorkQueue, InterviewSummary, LeadSummary, SessionUser } from "@orbit/contracts";
import { Card } from "@orbit/ui";

import { BdPeerRanking } from "../performance/bd-peer-ranking";
import { BdPersonalQuality } from "../performance/bd-personal-quality";
import { BdCalendarPreview } from "./bd-calendar-preview";
import { buildBdDailyActivitySummary } from "./bd-dashboard-kpis";

type PerformancePeriod = "day" | "7d" | "30d";

type BdDashboardProps = {
  actor: SessionUser;
  applications: LeadSummary[];
  interviews: InterviewSummary[];
  performance?: BdPerformanceResponse;
  performancePeriod?: PerformancePeriod;
  todayPerformance?: BdPerformanceResponse;
  workQueue?: BdWorkQueue;
  error?: string;
};

const stageColors = ["#e85f43", "#f08a64", "#d9953f", "#bd6d57"];
const periodLabels: Record<PerformancePeriod, string> = { day: "Today", "7d": "7 days", "30d": "30 days" };

function count(value: number | null | undefined): string {
  return value == null ? "—" : value.toLocaleString();
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

function platformName(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Other";
  }
}

function shortTimeZone(timeZone?: string): string {
  const labels: Record<string, string> = {
    "America/New_York": "US Eastern",
    "America/Chicago": "US Central",
    "America/Denver": "US Mountain",
    "America/Los_Angeles": "US Pacific",
  };
  return timeZone ? labels[timeZone] ?? timeZone.replaceAll("_", " ") : "US Eastern";
}

function PerformancePeriodControl({ period }: { period: PerformancePeriod }) {
  return <nav aria-label="Performance period" className="bd-performance-period">
    {(["day", "7d", "30d"] as const).map((value) => <a aria-current={period === value ? "page" : undefined} href={`/?performancePeriod=${value}`} key={value}>{periodLabels[value]}</a>)}
  </nav>;
}

function DailyActivityChart({ dailyTarget, workQueue }: { dailyTarget?: number | null; workQueue?: BdWorkQueue }) {
  const days = workQueue?.sevenDayApplicationTotals ?? [];
  const platforms = [...new Set(days.flatMap((day) => day.platformTotals.map((entry) => entry.platform)))];
  const colorByPlatform = new Map(platforms.map((platform, index) => [platform, stageColors[index % stageColors.length]]));
  const peak = Math.max(1, dailyTarget ?? 0, ...days.map((day) => day.total));
  const total = days.reduce((sum, day) => sum + day.total, 0);
  const average = days.length ? Math.round((total / days.length) * 10) / 10 : 0;
  const peakDay = days.reduce((highest, day) => day.total > highest ? day.total : highest, 0);
  const targetPosition = dailyTarget ? Math.min(100, (dailyTarget / peak) * 100) : null;
  const chartDescription = days.map((day) => `${day.date}: ${day.total}`).join(", ");

  return <>
    <dl className="bd-cadence-summary">
      <div><dt>Total</dt><dd>{count(total)}</dd></div>
      <div><dt>Average</dt><dd>{average}/day</dd></div>
      <div><dt>Peak</dt><dd>{count(peakDay)}</dd></div>
    </dl>
    <div aria-label={`BD seven day activity chart. ${chartDescription}`} className="bd-activity-chart" role="img">
      <div className="bd-chart-grid-lines" aria-hidden="true"><i /><i /><i /></div>
      {targetPosition !== null ? <span className="bd-chart-target" style={{ bottom: `${18 + targetPosition * 0.54}%` }}>Target {dailyTarget}</span> : null}
      <div className="bd-chart-bars">
        {days.map((day) => <div className="bd-chart-day" key={day.date}>
          <div className="bd-chart-bar" style={{ height: `${Math.max(day.total ? 10 : 2, (day.total / peak) * 72)}%` }} title={`${day.date}: ${day.total} applications`}>
            {day.platformTotals.map((entry) => <i key={entry.platform} style={{ height: `${day.total ? (entry.count / day.total) * 100 : 0}%`, backgroundColor: colorByPlatform.get(entry.platform) }} />)}
          </div>
          <span>{new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short" }).format(new Date(`${day.date}T12:00:00Z`))}</span>
          <b>{day.total || "·"}</b>
        </div>)}
      </div>
    </div>
  </>;
}

function DailyTracker({ dailyTarget, qualifiedToday, recruiterResponses, interviewsScheduled, workQueue }: { dailyTarget?: number | null; qualifiedToday?: number | null; recruiterResponses?: number | null; interviewsScheduled?: number | null; workQueue?: BdWorkQueue }) {
  const allPlatforms = workQueue?.todayPlatformTotals ?? [];
  const leadingPlatforms = allPlatforms.slice(0, 3);
  const otherCount = allPlatforms.slice(3).reduce((total, entry) => total + entry.count, 0);
  const visiblePlatforms = otherCount ? [...leadingPlatforms, { platform: "Other", count: otherCount }] : leadingPlatforms;
  const summary = buildBdDailyActivitySummary({
    qualifiedApplications: qualifiedToday ?? 0,
    dailyTarget,
    platforms: visiblePlatforms.map((entry, index) => ({ ...entry, tone: (["coral", "peach", "amber", "terracotta"] as const)[index] })),
  });
  const target = summary.dailyTarget ?? 0;
  const progress = target ? (summary.qualifiedApplications / target) * 100 : 0;
  const visibleProgress = Math.min(100, progress);
  const remaining = summary.remaining == null ? null : Math.max(0, summary.remaining);
  const savedToday = allPlatforms.reduce((total, platform) => total + platform.count, 0);

  return <Card aria-label="BD daily activity tracker" className="editorial-insight-card editorial-surface-feature bd-primary-surface p-5 sm:p-6">
    <header className="bd-card-header"><div><p className="bd-card-eyebrow">Today</p><h2>Daily activity tracker</h2></div><span className="bd-scope-pill">{shortTimeZone(workQueue?.businessTimeZone)}</span></header>
    <a aria-label={`View ${count(summary.qualifiedApplications)} qualified applications`} className="bd-progress-tube-link block" href="/leads">
      <div className="bd-progress-ring-wrap">
        <svg aria-hidden="true" className="bd-progress-ring" data-testid="bd-progress-ring" viewBox="0 0 220 220"><circle className="bd-progress-ring-track" cx="110" cy="110" r="88" /><circle className="bd-progress-ring-fill" cx="110" cy="110" r="88" pathLength="100" style={{ strokeDashoffset: `${100 - visibleProgress}` }} /></svg>
        <div className="bd-progress-ring-content"><strong>{count(summary.qualifiedApplications)}<span>/{count(summary.dailyTarget)}</span></strong><small>qualified applications</small><em>{progress > 100 ? `+${count(summary.qualifiedApplications - target)} above target` : remaining == null ? "Target unavailable" : `${count(remaining)} remaining`}</em></div>
      </div>
    </a>
    <dl className="bd-daily-milestones"><div><dt>Replies</dt><dd>{count(recruiterResponses)}</dd></div><div><dt>Interviews</dt><dd>{count(interviewsScheduled)}</dd></div></dl>
    <div className="bd-platform-breakdown"><div className="flex items-center justify-between gap-3"><strong>{count(savedToday)} saved today</strong><span>Platform mix</span></div><div className="bd-platform-stack" aria-label={`${savedToday} saved applications by platform`}>{summary.platforms.map((platform, index) => <i key={platform.platform} style={{ width: `${savedToday ? (platform.count / savedToday) * 100 : 0}%`, backgroundColor: stageColors[index] }} />)}</div><div className="bd-platform-legends">{summary.platforms.map((platform, index) => <span className="bd-platform-legend" key={platform.platform}><i style={{ backgroundColor: stageColors[index] }} />{platform.platform} · {platform.count}</span>)}</div></div>
  </Card>;
}

function CadencePanel({ dailyTarget, workQueue }: { dailyTarget?: number | null; workQueue?: BdWorkQueue }) {
  return <Card aria-label="BD seven day cadence" className="editorial-insight-card editorial-surface-grid bd-secondary-surface bd-cadence-panel p-4 sm:p-5"><header className="bd-card-header"><div><p className="bd-card-eyebrow">Cadence</p><h2>Last 7 days</h2></div></header><DailyActivityChart dailyTarget={dailyTarget} workQueue={workQueue} /></Card>;
}

function OperationalPulse({ applications, todayPerformance, workQueue }: { applications: LeadSummary[]; todayPerformance?: BdPerformanceResponse; workQueue?: BdWorkQueue }) {
  const responseCount = workQueue?.recruiterResponses ?? 0;
  const responseItems = applications.filter((application) => application.status === "RESPONSE_RECEIVED").slice(0, 3);
  const queueItems = [
    { label: "Calendar entries needed", value: todayPerformance?.performance.interviewsNeedingScheduling ?? 0, href: "/tasks", color: stageColors[2] },
    { label: "Follow-ups due", value: workQueue?.openFollowUps ?? 0, href: "/tasks", color: stageColors[3] },
  ].filter((item) => item.value > 0);
  const hasWork = responseCount > 0 || queueItems.length > 0;

  return <Card aria-label="BD operational pulse" className="editorial-insight-card editorial-surface-alert bd-primary-surface bd-pulse-panel p-4 sm:p-5"><header className="bd-card-header"><div><p className="bd-card-eyebrow">Operational pulse</p><h2>What needs attention</h2></div><a href="/tasks">Open queue →</a></header><div className="bd-pulse-scroll">
    {!hasWork ? <p className="bd-queue-clear"><span>✓</span>Queue clear</p> : null}
    {responseCount > 0 ? <div className="bd-attention-group"><div className="bd-attention-heading"><span>Responses to review</span><strong>{count(responseCount)}</strong></div>{responseItems.map((application) => <a className="bd-attention-row" href={`/leads/${application.id}`} key={application.id}><span className="bd-pulse-checkbox" aria-hidden="true" style={{ borderColor: stageColors[0] }} /><span><strong>{application.jobTitle}</strong><small>{application.companyName ?? "Company not recorded"}</small></span><b>Open →</b></a>)}{responseCount > responseItems.length ? <a className="bd-attention-more" href="/leads?status=RESPONSE_RECEIVED">+{responseCount - responseItems.length} more responses</a> : null}</div> : null}
    {queueItems.map((item) => <a className="bd-attention-row" href={item.href} key={item.label}><span className="bd-pulse-checkbox" aria-hidden="true" style={{ borderColor: item.color }} /><span><strong>{item.label}</strong></span><b>{count(item.value)}</b></a>)}
  </div></Card>;
}

function smoothCurve(points: Array<{ x: number; y: number }>): string {
  return points.slice(1).reduce((path, point, index) => {
    const previous = points[index];
    const midpoint = (previous.x + point.x) / 2;
    return `${path} C ${midpoint} ${previous.y}, ${midpoint} ${point.y}, ${point.x} ${point.y}`;
  }, `M ${points[0].x} ${points[0].y}`);
}

function placementBandPath(heights: number[], xPositions: number[], bandIndex: number): string {
  const center = 130;
  const bandStart = bandIndex / 4;
  const bandEnd = (bandIndex + 1) / 4;
  const upper = heights.map((height, index) => ({ x: xPositions[index], y: center - height / 2 + height * bandStart }));
  const lower = heights.map((height, index) => ({ x: xPositions[index], y: center - height / 2 + height * bandEnd })).reverse();
  return `${smoothCurve(upper)} L ${lower[0].x} ${lower[0].y} ${smoothCurve(lower).replace(/^M [\d.]+ [\d.]+/, "")} Z`;
}

export function placementStageThickness(value: number, largestValue: number): number {
  if (value <= 0 || largestValue <= 0) return 0;
  return Math.max(3, 160 * Math.min(value / largestValue, 1));
}

function FunnelAndTrend({ workQueue }: { workQueue?: BdWorkQueue }) {
  const totals = workQueue?.pipelineTotals;
  const journeyStages = [
    ["Jobs applied", totals?.jobsApplied, "/leads?pipelineStage=APPLIED"],
    ["Interviews", totals?.interviews, "/leads?pipelineStage=INTERVIEW"],
    ["Offers", totals?.offers, "/leads?pipelineStage=OFFER"],
    ["Placements", totals?.placements, "/leads?pipelineStage=PLACEMENT"],
  ] as const;
  const values = journeyStages.map(([, value]) => value ?? 0);
  const largestValue = Math.max(1, ...values);
  const heights = values.map((value) => placementStageThickness(value, largestValue));
  const xPositions = journeyStages.map((_, index) => 50 + index * (900 / (journeyStages.length - 1)));
  const flowLabel = `Placement flow: ${journeyStages.map(([label, value]) => `${label} ${count(value)}`).join(", ")}`;
  const conversion = (from?: number, to?: number) => from ? `${Math.round(((to ?? 0) / from) * 100)}%` : "—";
  return <Card aria-label="BD lifetime placement funnel" className="editorial-insight-card editorial-surface-lines p-5 sm:p-6"><header className="bd-card-header"><div><p className="bd-card-eyebrow">Lifetime view</p><h2>Placement journey</h2></div><div className="bd-lifetime-meta"><a aria-label={`${count(totals?.activeJobs)} active jobs now`} className="bd-lifetime-active" href="/leads?pipelineStage=ACTIVE"><strong>{count(totals?.activeJobs)}</strong> active now</a><span className="bd-scope-pill">All time</span></div></header><div className="bd-lifetime-flow-scroll"><div className="bd-lifetime-flow" data-testid="bd-lifetime-flow"><svg aria-label={flowLabel} preserveAspectRatio="none" role="img" viewBox="0 0 1000 260"><title>Lifetime placement journey</title><desc>Stream thickness is proportional to lifetime stage totals. Non-zero stages retain a three-pixel minimum; zero stages have no strand.</desc>{[0, 1, 2, 3].map((band) => <path className={`bd-lifetime-flow-band bd-lifetime-flow-band-${band + 1}`} d={placementBandPath(heights, xPositions, band)} key={band} />)}{xPositions.map((x) => <line className="bd-lifetime-flow-checkpoint" key={x} x1={x} x2={x} y1="28" y2="232" />)}</svg><div className="bd-lifetime-flow-labels">{journeyStages.map(([label, value, href], index) => <a className={`bd-lifetime-flow-label ${index % 2 ? "is-bottom" : "is-top"}`} href={href} key={label} style={{ left: `${xPositions[index] / 10}%` }}><span>{label}</span><strong>{count(value)}</strong></a>)}</div></div></div><div className="bd-funnel-conversions"><span>Applied → interview <strong>{conversion(totals?.jobsApplied, totals?.interviews)}</strong></span><span>Interview → offer <strong>{conversion(totals?.interviews, totals?.offers)}</strong></span><span>Offer → placement <strong>{conversion(totals?.offers, totals?.placements)}</strong></span></div></Card>;
}

function RecentApplications({ applications }: { applications: LeadSummary[] }) {
  const visibleApplications = applications.slice(0, 6);
  return <Card aria-label="BD recent applications" className="editorial-insight-card editorial-surface-soft bd-fixed-dashboard-card bd-secondary-surface p-5 sm:p-6"><header className="bd-card-header"><div><p className="bd-card-eyebrow">Intake history</p><h2>Recent applications</h2></div><a href="/leads">View all →</a></header><div className="bd-card-scroll">{visibleApplications.map((application) => <a className="bd-recent-row" href={`/leads/${application.id}`} key={application.id}><span><strong>{application.jobTitle}</strong><small>{application.companyName ?? "Company not recorded"} · {platformName(application.rawUrl)} · {application.appliedDate}</small></span><b>{application.status.replaceAll("_", " ")}</b></a>)}{visibleApplications.length === 0 ? <p className="bd-empty-state">Your application entries will appear here.</p> : null}</div></Card>;
}

export function BdDashboard({ actor, applications, interviews, performance, performancePeriod = "30d", todayPerformance, workQueue, error }: BdDashboardProps) {
  const now = new Date();
  const dailyTarget = todayPerformance?.currentDailyTarget ?? performance?.currentDailyTarget;
  const periodLabel = periodLabels[performancePeriod];
  return <div aria-label="BD application workspace" className="bd-dashboard-shell editorial-dashboard mx-auto max-w-[1500px]">
    <div className="bd-dashboard-hero-band editorial-hero"><div className="editorial-date-rail"><span className="editorial-date-number">{new Intl.DateTimeFormat("en-US", { day: "2-digit" }).format(now)}</span><span><strong>{new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }).format(now)}</strong><small>Daily target · {count(dailyTarget)}</small></span><a aria-label="Add application" className="editorial-add-button" href="/leads?new=application">+ Add application <span aria-hidden="true">›</span></a></div><div className="editorial-greeting"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">BD application desk</p><h1>Good morning, {firstName(actor.displayName)}</h1><p>Capture applications. Act on recruiter responses.</p></div></div>
    {error ? <p className="mt-4 rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning-foreground" role="status">{error}</p> : null}
    <section className="bd-flow-section bd-flow-section-primary mt-5"><div className="bd-activity-layout"><DailyTracker dailyTarget={dailyTarget} interviewsScheduled={todayPerformance?.performance.interviewsScheduled} qualifiedToday={todayPerformance?.performance.qualifiedApplications} recruiterResponses={todayPerformance?.performance.recruiterResponses} workQueue={workQueue} /><div className="bd-activity-rail"><CadencePanel dailyTarget={dailyTarget} workQueue={workQueue} /><OperationalPulse applications={applications} todayPerformance={todayPerformance} workQueue={workQueue} /></div></div></section>
    <section className="mt-5 grid gap-5 xl:grid-cols-2"><BdCalendarPreview interviews={interviews} /><RecentApplications applications={applications} /></section>
    <section className="mt-5"><FunnelAndTrend workQueue={workQueue} /></section>
    <section className="bd-performance-zone mt-5"><div className="bd-performance-zone-header"><div><p className="bd-card-eyebrow">Performance</p><h2>How you are tracking</h2></div><PerformancePeriodControl period={performancePeriod} /></div><div className="mt-3 grid gap-5 xl:grid-cols-2">{performance ? <BdPersonalQuality performance={performance} performancePeriod={performancePeriod} periodLabel={periodLabel} /> : <Card aria-label="Personal performance unavailable" className="editorial-insight-card bd-secondary-surface p-5 sm:p-6"><h2 className="text-xl font-bold text-foreground">Personal performance unavailable</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">Performance details are temporarily unavailable. Your daily queue is still available.</p></Card>}{performance ? <BdPeerRanking peers={performance.peerLeaderboard} periodLabel={periodLabel} selfBdId={actor.id} /> : null}</div></section>
  </div>;
}
