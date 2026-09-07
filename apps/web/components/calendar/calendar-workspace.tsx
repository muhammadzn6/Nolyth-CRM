"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CloserDashboardExternalMeeting, CreateInterview, InterviewSummary, LeadSummary, SessionUser, UserSummary } from "@orbit/contracts";
import { Card } from "@orbit/ui";
import { createLeadInterview, updateInterview } from "../../lib/api-client";
import { InterviewActions } from "../interviews/interview-actions";

type View = "month" | "week" | "day" | "agenda";
type CalendarItem =
  | { kind: "interview"; value: InterviewSummary }
  | { kind: "external"; value: CloserDashboardExternalMeeting };

const viewLabels: Array<[View, string]> = [["day", "D"], ["week", "W"], ["month", "M"], ["agenda", "Agenda"]];
const hours = Array.from({ length: 24 }, (_, index) => index);
const primaryTimezone = "America/New_York";
const secondaryTimezone = "Asia/Karachi";
const timezoneOptions = [
  ["America/New_York", "EST"],
  ["America/Chicago", "CST"],
  ["America/Denver", "MST"],
  ["America/Los_Angeles", "PST"],
  ["America/Anchorage", "AKST"],
  ["Pacific/Honolulu", "HST"],
  ["Asia/Karachi", "PKT"],
] as const;

function dateKey(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function startOfWeek(value: Date): Date {
  const result = new Date(value);
  result.setHours(0, 0, 0, 0);
  result.setDate(result.getDate() - result.getDay());
  return result;
}

function addDays(value: Date, amount: number): Date {
  const result = new Date(value);
  result.setDate(result.getDate() + amount);
  return result;
}

function formatMonth(value: Date): string {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(value);
}

function formatDay(value: Date): string {
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }).format(value);
}

function formatCalendarDate(value: Date): string {
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(value);
}

function formatMonthDate(value: Date): string {
  return value.getDate() === 1 ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(value) : String(value.getDate());
}

function formatTime(value: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: timezone }).format(new Date(value));
}

function timeParts(value: string, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "numeric", hour12: false, timeZone: timezone }).formatToParts(new Date(value));
  return { hour: Number(parts.find((part) => part.type === "hour")?.value ?? 0) % 24, minute: Number(parts.find((part) => part.type === "minute")?.value ?? 0) };
}

function formatClock(value: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: timezone }).format(value);
}

function formatHour(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

function timezoneHourDelta(value: Date, fromTimezone: string, toTimezone: string): number {
  const from = timeParts(value.toISOString(), fromTimezone).hour;
  const to = timeParts(value.toISOString(), toTimezone).hour;
  let delta = to - from;
  if (delta > 12) delta -= 24;
  if (delta < -12) delta += 24;
  return delta;
}

function dateKeyInTimezone(value: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: timezone }).formatToParts(value);
  return `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}-${parts.find((part) => part.type === "day")?.value}`;
}

function eventLabel(interview: InterviewSummary): string {
  return `${interview.roundType.replaceAll("_", " ")} · Round ${interview.roundNumber}`;
}

function eventColor(interview: InterviewSummary): string {
  if (interview.status === "RESCHEDULE_REQUIRED") return "border-warning bg-warning-soft text-warning-foreground";
  if (interview.status === "CANCELLED") return "border-border bg-surface-subtle text-muted-foreground line-through";
  return "border-primary/25 bg-primary-soft text-foreground";
}

function datesForView(anchor: Date, view: View): Date[] {
  if (view === "day") return [anchor];
  if (view === "week" || view === "agenda") return Array.from({ length: 7 }, (_, index) => addDays(startOfWeek(anchor), index));
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  return Array.from({ length: 42 }, (_, index) => addDays(startOfWeek(first), index));
}

function itemDates(item: CalendarItem): { startsAt: string; endsAt: string; timezone: string } {
  return item.kind === "interview" ? item.value : item.value;
}

export function CalendarWorkspace({ actor, interviews, externalMeetings = [], embedded = false, leads = [], closers = [], initialDate }: { actor: SessionUser; interviews: InterviewSummary[]; externalMeetings?: CloserDashboardExternalMeeting[]; embedded?: boolean; leads?: LeadSummary[]; closers?: UserSummary[]; initialDate?: string }) {
  const [view, setView] = useState<View>("day");
  const [anchor, setAnchor] = useState(() => {
    const selected = initialDate ? new Date(initialDate) : null;
    return selected && !Number.isNaN(selected.getTime()) ? selected : new Date();
  });
  const [status, setStatus] = useState("ALL");
  const [roundType, setRoundType] = useState("ALL");
  const [showCancelled, setShowCancelled] = useState(false);
  const [showInterviews, setShowInterviews] = useState(true);
  const [showExternal, setShowExternal] = useState(true);
  const [allCalendars, setAllCalendars] = useState(false);
  const [displaySettingsOpen, setDisplaySettingsOpen] = useState(false);
  const [showDetails, setShowDetails] = useState<CalendarItem | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<{ date: Date; hour: number } | null>(null);
  const [rescheduling, setRescheduling] = useState(false);
  const [enabledTimezones, setEnabledTimezones] = useState<string[]>([primaryTimezone, secondaryTimezone]);
  const [now, setNow] = useState(() => new Date());
  const calendarScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (view === "month" || view === "agenda") return;
    const { hour, minute } = timeParts(now.toISOString(), primaryTimezone);
    const currentTop = ((hour * 60 + minute) / 60) * 64;
    const scrollContainer = calendarScrollRef.current;
    if (scrollContainer) scrollContainer.scrollTop = Math.max(0, currentTop - scrollContainer.clientHeight / 2 + 32);
  }, [now, view]);

  const filteredInterviews = useMemo(() => interviews.filter((interview) =>
    showInterviews &&
    (actor.role !== "ADMIN" || allCalendars || interview.creatorId === actor.id) &&
    (status === "ALL" || interview.status === status) &&
    (roundType === "ALL" || interview.roundType === roundType) &&
    (showCancelled || interview.status !== "CANCELLED")), [actor.id, actor.role, allCalendars, interviews, roundType, showCancelled, showInterviews, status]);
  const items = useMemo<CalendarItem[]>(() => [
    ...filteredInterviews.map((value) => ({ kind: "interview" as const, value })),
    ...(showExternal ? externalMeetings.map((value) => ({ kind: "external" as const, value })) : []),
  ], [externalMeetings, filteredInterviews, showExternal]);
  const dates = datesForView(anchor, view);
  const grouped = useMemo(() => new Map(dates.map((date) => [dateKey(date), items.filter((item) => dateKey(new Date(itemDates(item).startsAt)) === dateKey(date))])), [dates, items]);
  const itemsInView = dates.flatMap((date) => grouped.get(dateKey(date)) ?? []);
  const title = view === "day" ? formatDay(anchor) : view === "week" || view === "agenda" ? `${formatDay(dates[0]!)} – ${formatDay(dates[6]!)}` : formatMonth(anchor);
  const move = (amount: number) => setAnchor((value) => {
    const next = new Date(value);
    if (view === "month") next.setMonth(next.getMonth() + amount);
    else next.setDate(next.getDate() + amount * (view === "day" ? 1 : 7));
    return next;
  });
  const allTypes = Array.from(new Set(interviews.map((interview) => interview.roundType))).sort();
  const canSchedule = actor.role !== "CLOSER" && leads.length > 0 && closers.length > 0;
  const handleReschedule = async (item: CalendarItem, date: Date, hour: number) => {
    if (item.kind !== "interview" || actor.role === "CLOSER") return;
    const startsAt = new Date(date);
    startsAt.setHours(hour, 0, 0, 0);
    const endsAt = new Date(startsAt);
    endsAt.setMinutes(endsAt.getMinutes() + Math.max(30, (new Date(item.value.endsAt).getTime() - new Date(item.value.startsAt).getTime()) / 60_000));
    setRescheduling(true);
    try {
      await updateInterview(item.value.id, { startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), timezone: item.value.timezone, originalDatetimeText: `${formatDay(startsAt)} · ${formatClock(startsAt, item.value.timezone)}`, expectedVersion: item.value.version });
      window.location.reload();
    } finally { setRescheduling(false); }
  };

  return (
    <div className={embedded ? "min-w-0 max-w-full" : "mx-auto min-w-0 max-w-[1500px]"}>
      {!embedded ? <header><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Scheduling workspace</p><h1 className="mt-2 text-2xl font-bold tracking-[-0.03em] text-foreground sm:text-3xl">Interview calendar</h1><p className="mt-1.5 text-sm text-muted-foreground">{actor.role === "ADMIN" ? "See every candidate calendar and interview in one place." : actor.role === "BD" ? "Track interviews for your assigned candidate profiles." : "Your assigned interviews and candidate calendar activity."}</p></header> : null}

      <section aria-label="Calendar view" className={`relative min-w-0 max-w-full overflow-hidden ${embedded ? "rounded-lg border border-border bg-surface shadow-[0_1px_2px_rgba(23,35,56,0.03)]" : "mt-6 rounded-lg border border-border bg-surface shadow-[0_1px_2px_rgba(23,35,56,0.03)]"}`}>
        <div className="calendar-floating-toolbar" aria-label="Calendar controls"><CalendarNavigation anchor={anchor} move={move} setAnchor={setAnchor} /><div className="flex rounded-lg border border-border bg-background p-1">{viewLabels.map(([value, label]) => <button aria-label={`${value[0]?.toUpperCase()}${value.slice(1)} view`} aria-pressed={view === value} className={`rounded-md px-2.5 py-1.5 text-xs font-semibold ${view === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`} key={value} onClick={() => setView(value)} type="button">{label}</button>)}</div><button aria-expanded={displaySettingsOpen} aria-label="Open calendar display settings" className={`grid size-9 place-items-center rounded-lg border ${displaySettingsOpen ? "border-primary bg-primary-soft text-primary" : "border-border bg-background text-muted-foreground hover:text-foreground"}`} onClick={() => setDisplaySettingsOpen((open) => !open)} type="button"><svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16M8 5v4m8-2v4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" /></svg></button>{displaySettingsOpen ? <CalendarDisplaySettings actor={actor} allCalendars={allCalendars} enabledTimezones={enabledTimezones} setAllCalendars={setAllCalendars} setEnabledTimezones={setEnabledTimezones} setShowExternal={setShowExternal} setShowInterviews={setShowInterviews} setShowCancelled={setShowCancelled} showCancelled={showCancelled} showExternal={showExternal} showInterviews={showInterviews} status={status} roundType={roundType} allTypes={allTypes} setStatus={setStatus} setRoundType={setRoundType} /> : null}</div>
        <div className="border-b border-border px-3 py-2 sm:px-4"><p className="text-base font-bold text-foreground">{title}</p></div>
        <div className={view === "month" ? "overflow-x-auto" : "h-[680px] overflow-auto"} data-testid={view === "month" ? undefined : view === "agenda" ? "calendar-view-scroll" : "calendar-time-scroll"} ref={view === "month" ? undefined : calendarScrollRef}>{view === "agenda" ? <AgendaView dates={dates} grouped={grouped} hasActiveFilters={status !== "ALL" || roundType !== "ALL" || showCancelled} onClearFilters={() => { setStatus("ALL"); setRoundType("ALL"); setShowCancelled(false); }} onSelect={setShowDetails} onToday={() => setAnchor(new Date())} /> : view === "month" ? <MonthGrid anchor={anchor} dates={dates} grouped={grouped} onSelect={setShowDetails} /> : <TimeGrid dates={dates} enabledTimezones={enabledTimezones} grouped={grouped} now={now} view={view} onSelect={setShowDetails} onSelectSlot={canSchedule ? setSelectedSlot : undefined} onReschedule={canSchedule ? handleReschedule : undefined} />}</div>
      </section>

      {showDetails ? <EventDetails actorRole={actor.role} item={showDetails} onClose={() => setShowDetails(null)} /> : null}
      {selectedSlot ? <ScheduleInterviewDrawer leads={leads} closers={closers} slot={selectedSlot} onClose={() => setSelectedSlot(null)} /> : null}
      {rescheduling ? <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background">Rescheduling interview…</div> : null}
    </div>
  );
}

function CalendarNavigation({ anchor, move, setAnchor }: { anchor: Date; move: (amount: number) => void; setAnchor: (value: Date) => void }) {
  return <div className="flex flex-wrap gap-2"><button className="rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-foreground hover:bg-surface-subtle" onClick={() => setAnchor(new Date())} type="button">Today</button><div className="flex rounded-lg border border-border bg-surface p-1"><button aria-label="Previous period" className="size-8 rounded-md text-lg text-muted-foreground hover:bg-surface-subtle" onClick={() => move(-1)} type="button">‹</button><button aria-label="Next period" className="size-8 rounded-md text-lg text-muted-foreground hover:bg-surface-subtle" onClick={() => move(1)} type="button">›</button></div></div>;
}

function CalendarDisplaySettings({ actor, allCalendars, enabledTimezones, setAllCalendars, setEnabledTimezones, setShowExternal, setShowInterviews, setShowCancelled, showCancelled, showExternal, showInterviews, status, roundType, allTypes, setStatus, setRoundType }: { actor: SessionUser; allCalendars: boolean; enabledTimezones: string[]; setAllCalendars: (value: boolean) => void; setEnabledTimezones: (value: string[]) => void; setShowExternal: (value: boolean) => void; setShowInterviews: (value: boolean) => void; setShowCancelled: (value: boolean) => void; showCancelled: boolean; showExternal: boolean; showInterviews: boolean; status: string; roundType: string; allTypes: string[]; setStatus: (value: string) => void; setRoundType: (value: string) => void }) {
  const toggleTimezone = (timezone: string) => setEnabledTimezones(enabledTimezones.includes(timezone) ? enabledTimezones.filter((value) => value !== timezone) : [...enabledTimezones, timezone]);
  return <div className="absolute right-3 top-14 z-30 w-72 rounded-2xl border border-border bg-surface p-4 text-left shadow-xl"><p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Calendar display</p><div className="mt-4 space-y-2.5"><p className="text-xs font-semibold text-muted-foreground">Timezones</p>{timezoneOptions.map(([timezone, label]) => <label className="flex items-center gap-2 text-xs font-medium text-foreground" key={timezone}><input checked={enabledTimezones.includes(timezone)} className="size-4 accent-primary" onChange={() => toggleTimezone(timezone)} type="checkbox" />{label}</label>)}</div><div className="mt-4 space-y-2.5 border-t border-border pt-4"><p className="text-xs font-semibold text-muted-foreground">Visible calendars</p><label className="flex items-center gap-2 text-xs font-medium text-foreground"><input checked={showInterviews} className="size-4 accent-primary" onChange={(event) => setShowInterviews(event.target.checked)} type="checkbox" />Orbit interviews</label><label className="flex items-center gap-2 text-xs font-medium text-foreground"><input checked={showExternal} className="size-4 accent-primary" onChange={(event) => setShowExternal(event.target.checked)} type="checkbox" />External Google events</label>{actor.role === "ADMIN" ? <label className="flex items-center gap-2 text-xs font-medium text-foreground"><input checked={allCalendars} className="size-4 accent-primary" onChange={(event) => setAllCalendars(event.target.checked)} type="checkbox" />All calendars</label> : <span className="block text-xs text-muted-foreground">Role-scoped calendar</span>}<label className="flex items-center gap-2 text-xs font-medium text-foreground"><input checked={showCancelled} className="size-4 accent-primary" onChange={(event) => setShowCancelled(event.target.checked)} type="checkbox" />Show cancelled</label></div><div className="mt-4 space-y-2.5 border-t border-border pt-4"><p className="text-xs font-semibold text-muted-foreground">Filters</p><label className="block text-xs font-medium text-foreground">Status<select aria-label="Calendar status filter" className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2 text-xs" value={status} onChange={(event) => setStatus(event.target.value)}><option value="ALL">All statuses</option><option value="SCHEDULED">Scheduled</option><option value="RESCHEDULE_REQUIRED">Needs reschedule</option><option value="WAITING_FEEDBACK">Waiting feedback</option></select></label><label className="block text-xs font-medium text-foreground">Interview type<select aria-label="Calendar interview type filter" className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2 text-xs" value={roundType} onChange={(event) => setRoundType(event.target.value)}><option value="ALL">All types</option>{allTypes.map((type) => <option key={type} value={type}>{type.replaceAll("_", " ")}</option>)}</select></label></div></div>;
}

function MonthGrid({ anchor, dates, grouped, onSelect }: { anchor: Date; dates: Date[]; grouped: Map<string, CalendarItem[]>; onSelect: (item: CalendarItem) => void }) {
  return <div className="min-w-[720px]"><div className="grid grid-cols-7 border-b border-border bg-surface-subtle">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <p className="border-r border-border px-2 py-2.5 text-center text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground last:border-r-0" key={day}>{day}</p>)}</div><div className="grid grid-cols-7">{dates.map((date) => { const items = grouped.get(dateKey(date)) ?? []; const outside = date.getMonth() !== anchor.getMonth(); return <div className={`min-h-[96px] border-b border-r border-border p-2 ${outside ? "calendar-month-inactive-cell bg-background/50" : "calendar-month-active-cell bg-surface"}`} key={dateKey(date)} data-testid={outside ? "calendar-inactive-month-date" : "calendar-active-month-date"}><p className={`text-xs font-semibold ${dateKey(date) === dateKey(new Date()) ? "grid size-6 place-items-center rounded-full bg-primary text-primary-foreground" : outside ? "text-muted-foreground/50" : "text-muted-foreground"}`}>{formatMonthDate(date)}</p>{items.length ? <button aria-label={`${items.length} interviews on ${formatCalendarDate(date)}`} className="calendar-month-count mt-3" onClick={() => onSelect(items[0]!)} type="button">{items.length}</button> : null}</div>; })}</div></div>;
}

function TimeGrid({ dates, enabledTimezones = [primaryTimezone, secondaryTimezone], grouped, view, now, onSelect, onSelectSlot, onReschedule }: { dates: Date[]; enabledTimezones?: string[]; grouped: Map<string, CalendarItem[]>; view: View; now: Date; onSelect: (item: CalendarItem) => void; onSelectSlot?: (slot: { date: Date; hour: number }) => void; onReschedule?: (item: CalendarItem, date: Date, hour: number) => Promise<void> }) {
  const dayColumns = view === "day" ? 1 : 7;
  const gridTemplateColumns = `4.5rem repeat(${dayColumns}, minmax(9rem, 1fr))`;
  const currentDateKey = dateKeyInTimezone(now, primaryTimezone);
  const nowParts = timeParts(now.toISOString(), primaryTimezone);
  const currentMinutes = nowParts.hour * 60 + nowParts.minute;
  const currentTop = Math.max(0, Math.min(hours.length * 64 - 2, (currentMinutes / 60) * 64));
  const visibleTimezoneLabels = enabledTimezones.filter((timezone) => timezone !== primaryTimezone);
  const secondaryDelta = timezoneHourDelta(now, primaryTimezone, secondaryTimezone);
  return <div className="min-w-[720px]" data-testid="calendar-time-grid"><div className="calendar-time-header sticky top-0 z-20 grid border-b border-border bg-surface-subtle" style={{ gridTemplateColumns, gridTemplateRows: "2rem 2.25rem" }}><div className="calendar-time-rail-header" style={{ gridColumn: "1", gridRow: "1 / span 2" }}><strong>US ET</strong><span>{visibleTimezoneLabels.includes(secondaryTimezone) ? "PKT" : "Time"}</span><span className="sr-only" data-testid="calendar-timezone-us">US Eastern</span><span className="sr-only" data-testid="calendar-timezone-pakistan">Pakistan</span></div>{dates.map((date) => <p className={`border-l border-border px-2 py-2 text-center text-[10px] font-bold uppercase tracking-[0.12em] ${dateKey(date) === currentDateKey ? "text-primary" : "text-muted-foreground"}`} key={dateKey(date)} style={{ gridColumn: dates.indexOf(date) + 2, gridRow: "1 / span 2" }}>{formatCalendarDate(date)}</p>)}</div><div className="grid" style={{ gridTemplateColumns }}><div className="calendar-time-rail" data-testid="calendar-timezone-column-America-New_York">{hours.map((hour) => <div className="calendar-time-cell" data-testid="calendar-hour" key={hour}><strong>{formatHour(hour)}</strong>{visibleTimezoneLabels.includes(secondaryTimezone) ? <small>{formatHour((hour + secondaryDelta + 24) % 24)}</small> : null}</div>)}</div>{dates.map((date) => <div className="relative border-l border-border" data-testid="calendar-day-column" key={dateKey(date)} onDragOver={(event) => { if (onReschedule) event.preventDefault(); }} onDrop={(event) => { const id = event.dataTransfer.getData("text/orbit-interview"); const item = Array.from(grouped.values()).flat().find((candidate) => candidate.kind === "interview" && candidate.value.id === id); if (item && onReschedule) { const rect = event.currentTarget.getBoundingClientRect(); void onReschedule(item, date, Math.max(0, Math.min(23, Math.floor((event.clientY - rect.top) / 64)))); } }}><div className="contents">{hours.map((hour) => <button aria-label={`Create interview at ${hour}:00`} className="block h-16 w-full border-b border-border text-left hover:bg-primary-soft/30 disabled:pointer-events-none" data-testid="calendar-hour-slot" disabled={!onSelectSlot} key={hour} onClick={() => onSelectSlot?.({ date, hour })} type="button" />)}</div>{dateKey(date) === currentDateKey ? <div aria-label={`Current time: ${formatClock(now, primaryTimezone)} US Eastern`} className="pointer-events-none absolute inset-x-0 z-10 flex items-center" data-testid="calendar-current-time" style={{ top: currentTop }}><span className="-ml-1.5 size-2.5 rounded-full bg-danger" /><span className="h-px flex-1 bg-danger" /><span className="absolute left-2 top-1 rounded-full bg-danger px-1.5 py-0.5 text-[9px] font-bold text-white">{formatClock(now, primaryTimezone)}</span></div> : null}{(grouped.get(dateKey(date)) ?? []).map((item) => <PositionedEvent item={item} key={`${item.kind}-${item.value.id}`} onSelect={onSelect} />)}</div>)}</div></div>;
}

function LegacyTimeGrid({ dates, enabledTimezones = [primaryTimezone, secondaryTimezone], grouped, view, now, onSelect, onSelectSlot, onReschedule }: { dates: Date[]; enabledTimezones?: string[]; grouped: Map<string, CalendarItem[]>; view: View; now: Date; onSelect: (item: CalendarItem) => void; onSelectSlot?: (slot: { date: Date; hour: number }) => void; onReschedule?: (item: CalendarItem, date: Date, hour: number) => Promise<void> }) {
  const dayColumns = view === "day" ? 1 : 7;
  const gridTemplateColumns = `repeat(${enabledTimezones.length}, 3rem) repeat(${dayColumns}, minmax(0, 1fr))`;
  const currentDateKey = dateKeyInTimezone(now, secondaryTimezone);
  const nowParts = timeParts(now.toISOString(), secondaryTimezone);
  const currentMinutes = nowParts.hour * 60 + nowParts.minute;
  const currentTop = Math.max(0, Math.min(hours.length * 64 - 2, ((currentMinutes - hours[0]! * 60) / 60) * 64));
  const timezoneSpan = enabledTimezones.length;

  return <div className="min-w-[720px]" data-testid="calendar-time-grid"><div className="sticky top-0 z-20 grid border-b border-border bg-surface-subtle" style={{ gridTemplateColumns, gridTemplateRows: "2rem 2.25rem" }}><div className="flex items-center justify-center border-r border-border px-1 text-center text-[9px] font-bold uppercase tracking-[0.08em] text-muted-foreground" style={{ gridColumn: `1 / span ${timezoneSpan}`, gridRow: "1 / span 2" }}><span>Time</span><span className="mt-1 block text-[8px] font-medium normal-case tracking-normal">PKT anchor</span></div>{enabledTimezones.map((timezone, index) => <p className="border-l border-border px-1 py-1 text-center text-[9px] font-bold uppercase tracking-[0.08em] text-muted-foreground" data-testid={timezone === primaryTimezone ? "calendar-timezone-us" : timezone === secondaryTimezone ? "calendar-timezone-pakistan" : `calendar-timezone-${timezone.replaceAll("/", "-")}`} key={timezone} style={{ gridColumn: index + 1, gridRow: 2 }}>{timezoneOptions.find(([value]) => value === timezone)?.[1] ?? timezone}</p>)}{dates.map((date, index) => <p className={`border-l border-border px-2 py-2 text-center text-[10px] font-bold uppercase tracking-[0.12em] ${dateKey(date) === currentDateKey ? "text-primary" : "text-muted-foreground"}`} key={dateKey(date)} style={{ gridColumn: timezoneSpan + index + 1, gridRow: "1 / span 2" }}>{formatCalendarDate(date)}</p>)}</div><div className="grid" style={{ gridTemplateColumns }}><div className="contents">{enabledTimezones.map((timezone) => <div className="border-l border-border bg-surface-subtle/25" data-testid={`calendar-timezone-column-${timezone.replaceAll("/", "-")}`} key={timezone}>{hours.map((hour) => { const instant = new Date(now); instant.setHours(hour, 0, 0, 0); return <div className="h-16 border-b border-border px-0.5 pt-1 text-center text-[9px] leading-4 text-muted-foreground" key={hour}><span className="block">{formatClock(instant, timezone)}</span></div>; })}</div>)}{dates.map((date) => <div className="relative border-l border-border" data-testid="calendar-day-column" key={dateKey(date)} onDragOver={(event) => { if (onReschedule) event.preventDefault(); }} onDrop={(event) => { const id = event.dataTransfer.getData("text/orbit-interview"); const item = Array.from(grouped.values()).flat().find((candidate) => candidate.kind === "interview" && candidate.value.id === id); if (item && onReschedule) { const rect = event.currentTarget.getBoundingClientRect(); void onReschedule(item, date, Math.max(0, Math.min(23, Math.floor((event.clientY - rect.top) / 64)))); } }}><div className="contents">{hours.map((hour) => <button aria-label={`Create interview at ${hour}:00`} className="block h-16 w-full border-b border-border text-left hover:bg-primary-soft/30 disabled:pointer-events-none" data-testid="calendar-hour-slot" disabled={!onSelectSlot} key={hour} onClick={() => onSelectSlot?.({ date, hour })} type="button" />)}</div>{dateKey(date) === currentDateKey ? <div aria-label={`Current time: ${formatClock(now, secondaryTimezone)} Pakistan`} className="pointer-events-none absolute inset-x-0 z-10 flex items-center" data-testid="calendar-current-time" style={{ top: currentTop }}><span className="-ml-1.5 size-2.5 rounded-full bg-danger" /><span className="h-px flex-1 bg-danger" /><span className="absolute left-2 top-1 rounded-full bg-danger px-1.5 py-0.5 text-[9px] font-bold text-white">{formatClock(now, secondaryTimezone)}</span></div> : null}{(grouped.get(dateKey(date)) ?? []).map((item) => <PositionedEvent item={item} key={`${item.kind}-${item.value.id}`} onSelect={onSelect} />)}</div>)}</div></div></div>;
}

function PositionedEvent({ item, onSelect }: { item: CalendarItem; onSelect: (item: CalendarItem) => void }) {
  const { startsAt, endsAt } = itemDates(item);
  const start = timeParts(startsAt, primaryTimezone);
  const top = Math.max(0, (start.hour * 60 + start.minute) / 60 * 64);
  const duration = Math.max(30, (new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60_000);
  return <div className="absolute inset-x-1" style={{ top, height: Math.max(38, duration / 60 * 64) }}><EventButton item={item} onSelect={onSelect} draggable={item.kind === "interview"} /></div>;
}

function EventButton({ item, onSelect, compact = false, draggable = false }: { item: CalendarItem; onSelect: (item: CalendarItem) => void; compact?: boolean; draggable?: boolean }) {
  const interview = item.kind === "interview" ? item.value : null;
  const timezone = primaryTimezone;
  const label = item.kind === "interview" ? eventLabel(item.value) : item.value.title;
  return <button className={`block w-full rounded-md border px-2 text-left text-[11px] font-semibold ${interview ? eventColor(interview) : "border-success/25 bg-success-soft text-foreground"} ${compact ? "py-1.5" : "h-full overflow-hidden py-1.5"}`} data-testid="calendar-event" draggable={draggable} onClick={() => onSelect(item)} onDragStart={(event) => { if (draggable && interview) event.dataTransfer.setData("text/orbit-interview", interview.id); }} type="button"><span className="block truncate">{formatTime(itemDates(item).startsAt, timezone)} · {label}</span><span className="mt-0.5 block truncate font-normal">{interview?.interviewer ? `Interviewer: ${interview.interviewer}` : item.kind === "external" ? "Google Calendar" : "Interviewer not added"}</span>{interview ? <span className="mt-0.5 block truncate text-[10px] font-bold uppercase tracking-[0.08em]">{interview.status}</span> : null}</button>;
}

function AgendaView({ dates, grouped, hasActiveFilters, onClearFilters, onSelect, onToday }: { dates: Date[]; grouped: Map<string, CalendarItem[]>; hasActiveFilters: boolean; onClearFilters: () => void; onSelect: (item: CalendarItem) => void; onToday: () => void }) {
  const rows = dates.flatMap((date) => (grouped.get(dateKey(date)) ?? []).map((item) => ({ date, item })));
  return <div className="divide-y divide-border">{rows.length ? rows.map(({ date, item }) => <button className="flex w-full items-start gap-4 p-4 text-left hover:bg-surface-subtle" data-testid="calendar-event" key={`${item.kind}-${item.value.id}`} onClick={() => onSelect(item)} type="button"><div className="w-28 shrink-0"><p className="text-xs font-bold text-foreground">{formatDay(date)}</p><p className="mt-1 text-xs text-muted-foreground">{formatTime(itemDates(item).startsAt, itemDates(item).timezone)}</p></div><div className={`min-w-0 flex-1 rounded-lg border px-3 py-2 ${item.kind === "interview" ? eventColor(item.value) : "border-success/25 bg-success-soft text-foreground"}`}><p className="text-sm font-semibold">{item.kind === "interview" ? eventLabel(item.value) : item.value.title}</p><p className="mt-1 text-xs">{item.kind === "interview" ? item.value.interviewer ?? "Interviewer not added" : "External Google Calendar event"} · {itemDates(item).timezone}</p></div></button>) : <div aria-label="Empty calendar agenda" className="flex min-h-[640px] flex-col items-center justify-center px-6 py-12 text-center"><div className="grid size-12 place-items-center rounded-2xl bg-primary-soft text-primary"><svg aria-hidden="true" className="size-6" fill="none" viewBox="0 0 24 24"><rect height="16" rx="2" stroke="currentColor" strokeWidth="1.8" width="16" x="4" y="5" /><path d="M8 3v4m8-4v4M4 10h16" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" /></svg></div><h3 className="mt-4 text-base font-bold text-foreground">{hasActiveFilters ? "No interviews match these filters" : "Your agenda is clear"}</h3><p className="mt-1 max-w-sm text-sm text-muted-foreground">{hasActiveFilters ? "Try clearing a filter to see more scheduled interviews." : "No interviews are scheduled for this view."}</p><div className="mt-5 flex flex-wrap justify-center gap-2"><button className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground" onClick={onToday} type="button">Today</button>{hasActiveFilters ? <button className="rounded-full border border-border bg-surface px-4 py-2 text-xs font-semibold text-foreground" onClick={onClearFilters} type="button">Clear filters</button> : null}</div></div>}</div>;
}

function EventDetails({ actorRole, item, onClose }: { actorRole: string; item: CalendarItem; onClose: () => void }) {
  const interview = item.kind === "interview" ? item.value : null;
  return <div className="fixed inset-0 z-50 flex justify-end bg-sidebar/30" role="presentation" onClick={onClose}><Card aria-label="Interview details" className="h-full w-full max-w-lg rounded-l-3xl rounded-r-none overflow-y-auto p-6 shadow-xl" onClick={(event) => event.stopPropagation()}><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">{interview ? "Interview details" : "Google Calendar event"}</p><h2 className="mt-2 text-xl font-bold text-foreground">{interview ? eventLabel(interview) : item.kind === "external" ? item.value.title : "Calendar event"}</h2></div><button aria-label="Close interview details" className="text-2xl leading-none text-muted-foreground" onClick={onClose} type="button">×</button></div><dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-xs font-semibold uppercase text-muted-foreground">When</dt><dd className="mt-1 text-foreground">{formatDay(new Date(itemDates(item).startsAt))} · {formatTime(itemDates(item).startsAt, itemDates(item).timezone)}–{formatTime(itemDates(item).endsAt, itemDates(item).timezone)}</dd></div>{interview ? <><div><dt className="text-xs font-semibold uppercase text-muted-foreground">Status</dt><dd className="mt-1 text-foreground">{interview.status.replaceAll("_", " ")}</dd></div><div><dt className="text-xs font-semibold uppercase text-muted-foreground">Interviewer</dt><dd className="mt-1 text-foreground">{interview.interviewer ?? "Not added"}</dd></div></> : <div><dt className="text-xs font-semibold uppercase text-muted-foreground">Location</dt><dd className="mt-1 text-foreground">{item.kind === "external" ? item.value.location ?? "Not specified" : "Not specified"}</dd></div>}<div><dt className="text-xs font-semibold uppercase text-muted-foreground">Timezone</dt><dd className="mt-1 text-foreground">{itemDates(item).timezone}</dd></div></dl>{interview?.preparationNotes ? <div className="mt-5 rounded-lg bg-surface-subtle p-3"><p className="text-xs font-semibold text-muted-foreground">Preparation</p><p className="mt-1 text-sm text-foreground">{interview.preparationNotes}</p></div> : null}{interview ? <InterviewActions actorRole={actorRole} id={interview.id} status={interview.status} version={interview.version} /> : null}{item.kind === "interview" ? item.value.meetingLink ? <a className="mt-5 inline-flex rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground" href={item.value.meetingLink}>Open meeting link</a> : null : item.value.meetingLink ? <a className="mt-5 inline-flex rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground" href={item.value.meetingLink}>Open meeting link</a> : null}</Card></div>;
}

function ScheduleInterviewDrawer({ leads, closers, slot, onClose }: { leads: LeadSummary[]; closers: UserSummary[]; slot: { date: Date; hour: number }; onClose: () => void }) {
  const [leadId, setLeadId] = useState(leads[0]?.id ?? "");
  const [closerId, setCloserId] = useState(closers[0]?.id ?? "");
  const [roundType, setRoundType] = useState<CreateInterview["roundType"]>("TECHNICAL");
  const [startsAt, setStartsAt] = useState(() => { const value = new Date(slot.date); value.setHours(slot.hour, 0, 0, 0); return value.toISOString().slice(0, 16); });
  const [endsAt, setEndsAt] = useState(() => { const value = new Date(slot.date); value.setHours(slot.hour + 1, 0, 0, 0); return value.toISOString().slice(0, 16); });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const submit = async (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); setPending(true); setError(undefined); try { await createLeadInterview(leadId, { closerId, roundType, startsAt: new Date(startsAt).toISOString(), endsAt: new Date(endsAt).toISOString(), timezone: secondaryTimezone, originalDatetimeText: `${startsAt} (${secondaryTimezone})` }); window.location.reload(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Interview could not be scheduled."); setPending(false); } };
  return <div className="fixed inset-0 z-50 flex justify-end bg-sidebar/30" role="presentation" onClick={onClose}><Card aria-label="Schedule interview" className="h-full w-full max-w-lg rounded-l-3xl rounded-r-none overflow-y-auto p-6 shadow-xl" onClick={(event) => event.stopPropagation()}><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">New interview</p><h2 className="mt-2 text-xl font-bold text-foreground">Schedule interview</h2><p className="mt-1 text-sm text-muted-foreground">Start from the selected Pakistan time slot.</p></div><button aria-label="Close schedule interview" className="text-2xl leading-none text-muted-foreground" onClick={onClose} type="button">×</button></div><form className="mt-6 grid gap-4" onSubmit={submit}><label className="grid gap-1 text-sm font-semibold text-foreground">Application<select className="h-11 rounded-xl border border-border bg-surface px-3 text-sm font-normal" onChange={(event) => setLeadId(event.target.value)} required value={leadId}><option value="">Select an application</option>{leads.map((lead) => <option key={lead.id} value={lead.id}>{lead.jobTitle}{lead.companyName ? ` · ${lead.companyName}` : ""}</option>)}</select></label><label className="grid gap-1 text-sm font-semibold text-foreground">Closer<select className="h-11 rounded-xl border border-border bg-surface px-3 text-sm font-normal" onChange={(event) => setCloserId(event.target.value)} required value={closerId}><option value="">Select a closer</option>{closers.map((closer) => <option key={closer.id} value={closer.id}>{closer.displayName}</option>)}</select></label><label className="grid gap-1 text-sm font-semibold text-foreground">Round type<select className="h-11 rounded-xl border border-border bg-surface px-3 text-sm font-normal" onChange={(event) => setRoundType(event.target.value as CreateInterview["roundType"])} value={roundType}><option value="TECHNICAL">Technical</option><option value="RECRUITER">Recruiter</option><option value="HR">HR</option><option value="FINAL">Final</option><option value="OTHER">Other</option></select></label><div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-1 text-sm font-semibold text-foreground">Starts<input className="h-11 rounded-xl border border-border bg-surface px-3 text-sm font-normal" onChange={(event) => setStartsAt(event.target.value)} required type="datetime-local" value={startsAt} /></label><label className="grid gap-1 text-sm font-semibold text-foreground">Ends<input className="h-11 rounded-xl border border-border bg-surface px-3 text-sm font-normal" onChange={(event) => setEndsAt(event.target.value)} required type="datetime-local" value={endsAt} /></label></div><div className="flex items-center gap-3"><button className="rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50" disabled={pending || !leadId || !closerId} type="submit">{pending ? "Scheduling…" : "Schedule interview"}</button><button className="rounded-full border border-border px-4 py-2.5 text-sm font-semibold text-foreground" onClick={onClose} type="button">Cancel</button></div>{error ? <p className="text-sm font-semibold text-danger" role="alert">{error}</p> : null}</form></Card></div>;
}
