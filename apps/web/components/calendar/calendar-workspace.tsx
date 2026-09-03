"use client";

import { useMemo, useState } from "react";
import type { CloserDashboardExternalMeeting, InterviewSummary, SessionUser } from "@orbit/contracts";
import { Card } from "@orbit/ui";
import { InterviewActions } from "../interviews/interview-actions";

type View = "month" | "week" | "day" | "agenda";
type CalendarItem =
  | { kind: "interview"; value: InterviewSummary }
  | { kind: "external"; value: CloserDashboardExternalMeeting };

const viewLabels: Array<[View, string]> = [["month", "Month"], ["week", "Week"], ["day", "Day"], ["agenda", "Agenda"]];
const hours = Array.from({ length: 17 }, (_, index) => index + 6);

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
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(value);
}

function formatTime(value: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: timezone }).format(new Date(value));
}

function timeParts(value: string, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "numeric", hour12: false, timeZone: timezone }).formatToParts(new Date(value));
  return { hour: Number(parts.find((part) => part.type === "hour")?.value ?? 0) % 24, minute: Number(parts.find((part) => part.type === "minute")?.value ?? 0) };
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

export function CalendarWorkspace({ actor, interviews, externalMeetings = [], embedded = false }: { actor: SessionUser; interviews: InterviewSummary[]; externalMeetings?: CloserDashboardExternalMeeting[]; embedded?: boolean }) {
  const firstInterview = interviews[0] ? new Date(interviews[0].startsAt) : new Date();
  const [view, setView] = useState<View>("month");
  const [anchor, setAnchor] = useState(firstInterview);
  const [status, setStatus] = useState("ALL");
  const [roundType, setRoundType] = useState("ALL");
  const [showCancelled, setShowCancelled] = useState(false);
  const [showInterviews, setShowInterviews] = useState(true);
  const [showExternal, setShowExternal] = useState(true);
  const [allCalendars, setAllCalendars] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [showDetails, setShowDetails] = useState<CalendarItem | null>(null);

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
  const interviewCount = itemsInView.filter((item) => item.kind === "interview").length;
  const externalCount = itemsInView.filter((item) => item.kind === "external").length;

  return (
    <div className={embedded ? "" : "mx-auto max-w-[1500px]"}>
      {!embedded ? <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Scheduling workspace</p><h1 className="mt-2 text-2xl font-bold tracking-[-0.03em] text-foreground sm:text-3xl">Interview calendar</h1><p className="mt-1.5 text-sm text-muted-foreground">{actor.role === "ADMIN" ? "See every candidate calendar and interview in one place." : actor.role === "BD" ? "Track interviews for your assigned candidate profiles." : "Your assigned interviews and candidate calendar activity."}</p></div><CalendarNavigation anchor={anchor} move={move} setAnchor={setAnchor} /></header> : null}

      <section aria-label="Calendar view" className={embedded ? "rounded-lg border border-border bg-surface shadow-[0_1px_2px_rgba(23,35,56,0.03)]" : "mt-6 rounded-lg border border-border bg-surface shadow-[0_1px_2px_rgba(23,35,56,0.03)]"}>
        <div className="flex flex-col gap-3 border-b border-border p-3 sm:p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-lg font-bold text-foreground">{title}</p><p className="mt-1 text-xs text-muted-foreground">{interviewCount} Orbit interview{interviewCount === 1 ? "" : "s"} in view{externalCount ? ` · ${externalCount} Google event${externalCount === 1 ? "" : "s"}` : ""} · {Intl.DateTimeFormat().resolvedOptions().timeZone}</p></div><div className="flex flex-wrap items-center gap-2"><div className="flex rounded-lg border border-border bg-background p-1">{viewLabels.map(([value, label]) => <button aria-pressed={view === value} className={`rounded-md px-2.5 py-1.5 text-xs font-semibold sm:px-3 ${view === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`} key={value} onClick={() => setView(value)} type="button">{label}</button>)}</div><div className="relative"><button aria-expanded={filtersOpen} aria-label="Open calendar filters" className={`grid size-9 place-items-center rounded-lg border ${filtersOpen || status !== "ALL" || roundType !== "ALL" || showCancelled ? "border-primary bg-primary-soft text-primary" : "border-border bg-background text-muted-foreground hover:text-foreground"}`} onClick={() => setFiltersOpen((open) => !open)} type="button"><svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24"><path d="M4 6h16M7 12h10m-7 6h4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" /></svg></button>{filtersOpen ? <div className="fixed inset-x-4 top-20 z-30 rounded-xl border border-border bg-surface p-4 text-left shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-11 sm:w-64"><div className="flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Filter calendar</p><button aria-label="Close calendar filters" className="text-lg text-muted-foreground sm:hidden" onClick={() => setFiltersOpen(false)} type="button">×</button></div><label className="mt-4 block text-xs font-semibold text-muted-foreground">Status<select className="mt-1.5 min-h-10 w-full rounded-lg border border-border bg-background px-2 text-sm text-foreground" value={status} onChange={(event) => setStatus(event.target.value)}><option value="ALL">All statuses</option><option value="SCHEDULED">Scheduled</option><option value="RESCHEDULE_REQUIRED">Needs reschedule</option><option value="WAITING_FEEDBACK">Waiting feedback</option></select></label><label className="mt-3 block text-xs font-semibold text-muted-foreground">Interview type<select className="mt-1.5 min-h-10 w-full rounded-lg border border-border bg-background px-2 text-sm text-foreground" value={roundType} onChange={(event) => setRoundType(event.target.value)}><option value="ALL">All types</option>{allTypes.map((type) => <option key={type} value={type}>{type.replaceAll("_", " ")}</option>)}</select></label><label className="mt-4 flex items-center gap-2 text-xs font-medium text-muted-foreground"><input checked={showCancelled} className="size-4 accent-primary" onChange={(event) => setShowCancelled(event.target.checked)} type="checkbox" /> Show cancelled</label></div> : null}</div></div></div><div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground"><label className="inline-flex items-center gap-2"><input checked={showInterviews} className="size-4 accent-primary" onChange={(event) => setShowInterviews(event.target.checked)} type="checkbox" /><span className="size-2 rounded-full bg-primary" />Orbit interviews</label><label className="inline-flex items-center gap-2"><input checked={showExternal} className="size-4 accent-primary" onChange={(event) => setShowExternal(event.target.checked)} type="checkbox" /><span className="size-2 rounded-full bg-success" />External Google events</label>{actor.role === "ADMIN" ? <label className="inline-flex items-center gap-2 font-semibold text-foreground"><input checked={allCalendars} className="size-4 accent-primary" onChange={(event) => setAllCalendars(event.target.checked)} type="checkbox" />All calendars</label> : <span>Role-scoped calendar</span>}<span className="hidden sm:inline">·</span><span><span className="mr-1.5 inline-block size-2 rounded-full bg-warning" />Scheduling issue</span></div></div>
        {itemsInView.length === 0 ? <p className="border-b border-border bg-surface-subtle px-4 py-2.5 text-xs font-medium text-muted-foreground" role="status">No events in this scope. Adjust the calendar filters or add an interview.</p> : null}
        <div className="overflow-x-auto">{view === "agenda" ? <AgendaView dates={dates} grouped={grouped} onSelect={setShowDetails} /> : view === "month" ? <MonthGrid anchor={anchor} dates={dates} grouped={grouped} onSelect={setShowDetails} /> : <TimeGrid dates={dates} grouped={grouped} view={view} onSelect={setShowDetails} />}</div>
      </section>

      {showDetails ? <EventDetails actorRole={actor.role} item={showDetails} onClose={() => setShowDetails(null)} /> : null}
    </div>
  );
}

function CalendarNavigation({ anchor, move, setAnchor }: { anchor: Date; move: (amount: number) => void; setAnchor: (value: Date) => void }) {
  return <div className="flex flex-wrap gap-2"><button className="rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-foreground hover:bg-surface-subtle" onClick={() => setAnchor(new Date())} type="button">Today</button><div className="flex rounded-lg border border-border bg-surface p-1"><button aria-label="Previous period" className="size-8 rounded-md text-lg text-muted-foreground hover:bg-surface-subtle" onClick={() => move(-1)} type="button">‹</button><button aria-label="Next period" className="size-8 rounded-md text-lg text-muted-foreground hover:bg-surface-subtle" onClick={() => move(1)} type="button">›</button></div></div>;
}

function MonthGrid({ anchor, dates, grouped, onSelect }: { anchor: Date; dates: Date[]; grouped: Map<string, CalendarItem[]>; onSelect: (item: CalendarItem) => void }) {
  return <div className="min-w-[720px]"><div className="grid grid-cols-7 border-b border-border bg-surface-subtle">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <p className="border-r border-border px-2 py-2.5 text-center text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground last:border-r-0" key={day}>{day}</p>)}</div><div className="grid grid-cols-7">{dates.map((date) => { const items = grouped.get(dateKey(date)) ?? []; const outside = date.getMonth() !== anchor.getMonth(); return <div className={`min-h-[96px] border-b border-r border-border p-2 ${outside ? "bg-background/50" : "bg-surface"}`} key={dateKey(date)}><p className={`text-xs font-semibold ${dateKey(date) === dateKey(new Date()) ? "grid size-6 place-items-center rounded-full bg-primary text-primary-foreground" : outside ? "text-muted-foreground/50" : "text-muted-foreground"}`}>{date.getDate()}</p><div className="mt-2 space-y-1">{items.map((item) => <EventButton item={item} key={`${item.kind}-${item.value.id}`} onSelect={onSelect} compact />)}</div></div>; })}</div></div>;
}

function TimeGrid({ dates, grouped, view, onSelect }: { dates: Date[]; grouped: Map<string, CalendarItem[]>; view: View; onSelect: (item: CalendarItem) => void }) {
  const columns = view === "day" ? "grid-cols-[4rem_minmax(0,1fr)]" : "grid-cols-[4rem_repeat(7,minmax(0,1fr))]";
  return <div className="min-w-[720px]" data-testid="calendar-time-grid"><div className={`grid ${columns} border-b border-border bg-surface-subtle`}> <div />{dates.map((date) => <p className="border-l border-border px-2 py-3 text-center text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground" key={dateKey(date)}>{view === "day" ? formatDay(date) : new Intl.DateTimeFormat("en-US", { weekday: "short", day: "numeric" }).format(date)}</p>)}</div><div className={`grid ${columns}`}> <div>{hours.map((hour) => <div className="h-16 border-b border-border px-2 pt-1 text-[10px] text-muted-foreground" data-testid="calendar-hour" key={hour}>{hour > 12 ? hour - 12 : hour}{hour >= 12 ? " PM" : " AM"}</div>)}</div>{dates.map((date) => <div className="relative border-l border-border" data-testid="calendar-day-column" key={dateKey(date)}>{hours.map((hour) => <div className="h-16 border-b border-border" key={hour} />)}{(grouped.get(dateKey(date)) ?? []).map((item) => <PositionedEvent item={item} key={`${item.kind}-${item.value.id}`} onSelect={onSelect} />)}</div>)}</div></div>;
}

function PositionedEvent({ item, onSelect }: { item: CalendarItem; onSelect: (item: CalendarItem) => void }) {
  const { startsAt, endsAt, timezone } = itemDates(item);
  const start = timeParts(startsAt, timezone); const end = timeParts(endsAt, timezone);
  const top = Math.max(0, ((start.hour * 60 + start.minute) - 6 * 60) / 60 * 64); const duration = Math.max(30, (end.hour * 60 + end.minute) - (start.hour * 60 + start.minute));
  return <div className="absolute inset-x-1" style={{ top, height: Math.max(38, duration / 60 * 64) }}><EventButton item={item} onSelect={onSelect} /></div>;
}

function EventButton({ item, onSelect, compact = false }: { item: CalendarItem; onSelect: (item: CalendarItem) => void; compact?: boolean }) {
  const interview = item.kind === "interview" ? item.value : null;
  const timezone = itemDates(item).timezone;
  const label = item.kind === "interview" ? eventLabel(item.value) : item.value.title;
  return <button className={`block w-full rounded-md border px-2 text-left text-[11px] font-semibold ${interview ? eventColor(interview) : "border-success/25 bg-success-soft text-foreground"} ${compact ? "py-1.5" : "h-full overflow-hidden py-1.5"}`} data-testid="calendar-event" onClick={() => onSelect(item)} type="button"><span className="block truncate">{formatTime(itemDates(item).startsAt, timezone)} · {label}</span><span className="mt-0.5 block truncate font-normal">{interview?.interviewer ? `Interviewer: ${interview.interviewer}` : item.kind === "external" ? "Google Calendar" : "Interviewer not added"}</span>{interview ? <span className="mt-0.5 block truncate text-[10px] font-bold uppercase tracking-[0.08em]">{interview.status}</span> : null}</button>;
}

function AgendaView({ dates, grouped, onSelect }: { dates: Date[]; grouped: Map<string, CalendarItem[]>; onSelect: (item: CalendarItem) => void }) {
  const rows = dates.flatMap((date) => (grouped.get(dateKey(date)) ?? []).map((item) => ({ date, item })));
  return <div className="divide-y divide-border">{rows.length ? rows.map(({ date, item }) => <button className="flex w-full items-start gap-4 p-4 text-left hover:bg-surface-subtle" data-testid="calendar-event" key={`${item.kind}-${item.value.id}`} onClick={() => onSelect(item)} type="button"><div className="w-28 shrink-0"><p className="text-xs font-bold text-foreground">{formatDay(date)}</p><p className="mt-1 text-xs text-muted-foreground">{formatTime(itemDates(item).startsAt, itemDates(item).timezone)}</p></div><div className={`min-w-0 flex-1 rounded-lg border px-3 py-2 ${item.kind === "interview" ? eventColor(item.value) : "border-success/25 bg-success-soft text-foreground"}`}><p className="text-sm font-semibold">{item.kind === "interview" ? eventLabel(item.value) : item.value.title}</p><p className="mt-1 text-xs">{item.kind === "interview" ? item.value.interviewer ?? "Interviewer not added" : "External Google Calendar event"} · {itemDates(item).timezone}</p></div></button>) : <p className="p-8 text-sm text-muted-foreground">No calendar events match the selected filters.</p>}</div>;
}

function EventDetails({ actorRole, item, onClose }: { actorRole: string; item: CalendarItem; onClose: () => void }) {
  const interview = item.kind === "interview" ? item.value : null;
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-sidebar/30 p-4 sm:items-center" role="presentation" onClick={onClose}><Card aria-label="Interview details" className="w-full max-w-lg p-6 shadow-xl" onClick={(event) => event.stopPropagation()}><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">{interview ? "Interview details" : "Google Calendar event"}</p><h2 className="mt-2 text-xl font-bold text-foreground">{interview ? eventLabel(interview) : item.kind === "external" ? item.value.title : "Calendar event"}</h2></div><button aria-label="Close interview details" className="text-2xl leading-none text-muted-foreground" onClick={onClose} type="button">×</button></div><dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-xs font-semibold uppercase text-muted-foreground">When</dt><dd className="mt-1 text-foreground">{formatDay(new Date(itemDates(item).startsAt))} · {formatTime(itemDates(item).startsAt, itemDates(item).timezone)}–{formatTime(itemDates(item).endsAt, itemDates(item).timezone)}</dd></div>{interview ? <><div><dt className="text-xs font-semibold uppercase text-muted-foreground">Status</dt><dd className="mt-1 text-foreground">{interview.status.replaceAll("_", " ")}</dd></div><div><dt className="text-xs font-semibold uppercase text-muted-foreground">Interviewer</dt><dd className="mt-1 text-foreground">{interview.interviewer ?? "Not added"}</dd></div></> : <div><dt className="text-xs font-semibold uppercase text-muted-foreground">Location</dt><dd className="mt-1 text-foreground">{item.kind === "external" ? item.value.location ?? "Not specified" : "Not specified"}</dd></div>}<div><dt className="text-xs font-semibold uppercase text-muted-foreground">Timezone</dt><dd className="mt-1 text-foreground">{itemDates(item).timezone}</dd></div></dl>{interview?.preparationNotes ? <div className="mt-5 rounded-lg bg-surface-subtle p-3"><p className="text-xs font-semibold text-muted-foreground">Preparation</p><p className="mt-1 text-sm text-foreground">{interview.preparationNotes}</p></div> : null}{interview ? <InterviewActions actorRole={actorRole} id={interview.id} status={interview.status} version={interview.version} /> : null}{item.kind === "interview" ? item.value.meetingLink ? <a className="mt-5 inline-flex rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground" href={item.value.meetingLink}>Open meeting link</a> : null : item.value.meetingLink ? <a className="mt-5 inline-flex rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground" href={item.value.meetingLink}>Open meeting link</a> : null}</Card></div>;
}
