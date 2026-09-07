"use client";

import { useEffect, useRef, useState } from "react";
import type { InterviewSummary } from "@orbit/contracts";
import { Card } from "@orbit/ui";

const primaryTimezone = "America/New_York";
const secondaryTimezone = "Asia/Karachi";
type CalendarView = "day" | "week" | "month" | "agenda";

function keyFor(date: Date, timeZone = primaryTimezone): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(date);
}

function calendarAnchor(value = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: primaryTimezone,
    year: "numeric",
  }).formatToParts(value);
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
  return new Date(Date.UTC(values.year, values.month - 1, values.day, 12));
}

function calendarKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function clockFor(value: string | Date, timeZone = primaryTimezone): string {
  return new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone }).format(new Date(value));
}

function eventLabelFor(date: Date, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("en-US", { ...options, timeZone: primaryTimezone }).format(date);
}

function calendarLabelFor(date: Date, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("en-US", { ...options, timeZone: "UTC" }).format(date);
}

function offsetHours(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
  return (Date.UTC(values.year, values.month - 1, values.day, values.hour, values.minute, values.second) - date.getTime()) / 3600000;
}

function interviewsFor(interviews: InterviewSummary[], date: Date): InterviewSummary[] {
  return interviews.filter((interview) => keyFor(new Date(interview.startsAt)) === calendarKey(date)).sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
}

function hourInZone(value: string, timeZone = primaryTimezone): number {
  return Number(new Intl.DateTimeFormat("en-US", { hour: "2-digit", hourCycle: "h23", timeZone }).format(new Date(value)));
}

export function BdCalendarPreview({ interviews }: { interviews: InterviewSummary[] }) {
  const [view, setView] = useState<CalendarView>("month");
  const [anchor, setAnchor] = useState(() => calendarAnchor());
  const timeGridRef = useRef<HTMLDivElement>(null);
  const now = calendarAnchor();
  const monthStart = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1, 12));
  const monthDates = Array.from({ length: 42 }, (_, index) => new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), index - monthStart.getUTCDay() + 1, 12)));
  const weekDates = Array.from({ length: 7 }, (_, index) => new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), anchor.getUTCDate() - anchor.getUTCDay() + index, 12)));
  const selectedDayEvents = interviewsFor(interviews, anchor);
  const viewDates = view === "month" ? monthDates : view === "week" ? weekDates : [anchor];
  const shift = (amount: number) => setAnchor((current) => { const next = new Date(current); if (view === "month") next.setUTCMonth(current.getUTCMonth() + amount); else next.setUTCDate(current.getUTCDate() + amount * (view === "week" ? 7 : 1)); return next; });
  const periodLabel = view === "month" ? calendarLabelFor(monthStart, { month: "long", year: "numeric" }) : view === "week" ? `${calendarLabelFor(weekDates[0]!, { month: "short", day: "numeric" })} – ${calendarLabelFor(weekDates[6]!, { month: "short", day: "numeric", year: "numeric" })}` : calendarLabelFor(anchor, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  const views: [CalendarView, string][] = [["day", "D"], ["week", "W"], ["month", "M"], ["agenda", "Agenda"]];

  useEffect(() => {
    if (view !== "day") return;
    const grid = timeGridRef.current;
    const hour = calendarKey(anchor) === calendarKey(now) ? hourInZone(new Date().toISOString()) : 9;
    const row = grid?.querySelector<HTMLElement>(`[data-hour="${hour}"]`);
    if (!grid || !row || typeof grid.scrollTo !== "function") return;
    const rowTop = row.getBoundingClientRect().top - grid.getBoundingClientRect().top + grid.scrollTop;
    grid.scrollTo({ behavior: "smooth", top: Math.max(0, rowTop - (grid.clientHeight - row.getBoundingClientRect().height) / 2) });
  }, [anchor, view]);

  return <Card aria-label="BD calendar" className="editorial-insight-card bd-calendar-card p-5 sm:p-6">
    <header className="bd-mini-calendar-header">
      <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Calendar</p><h2 className="mt-1 text-xl font-bold text-foreground">{periodLabel}</h2></div>
      <div className="bd-mini-calendar-toolbar"><div className="bd-mini-calendar-actions"><button aria-label="Previous calendar period" onClick={() => shift(-1)} type="button">‹</button><button aria-label="Today" onClick={() => setAnchor(calendarAnchor())} type="button">Today</button><button aria-label="Next calendar period" onClick={() => shift(1)} type="button">›</button></div><div aria-label="BD calendar views" className="bd-mini-calendar-views">{views.map(([value, label], index) => <span key={value}>{index ? <i aria-hidden="true">/</i> : null}<button aria-label={`${value === "day" ? "Day" : value === "week" ? "Week" : value === "month" ? "Month" : "Agenda"} calendar view`} aria-pressed={view === value} onClick={() => setView(value)} type="button">{label}</button></span>)}</div></div>
    </header>
    {view === "agenda" ? <div className="bd-mini-agenda" data-testid="bd-mini-agenda">{interviews.length ? interviews.slice().sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt)).map((interview) => <a href={`/leads/${interview.leadId}/interviews?edit=${interview.id}`} key={interview.id}><time>{eventLabelFor(new Date(interview.startsAt), { weekday: "short", month: "short", day: "numeric" })} · {clockFor(interview.startsAt)} ET · {clockFor(interview.startsAt, secondaryTimezone)} PKT</time><strong>{interview.roundType.replaceAll("_", " ")} · Round {interview.roundNumber}</strong></a>) : <span>No interviews scheduled</span>}</div> : view === "day" ? <div className="bd-mini-time-grid overflow-y-auto" data-testid="bd-mini-time-grid" ref={timeGridRef}><div className="bd-mini-time-header"><strong>{calendarLabelFor(anchor, { weekday: "short", month: "short", day: "numeric" })}</strong><span>US ET · PKT</span></div>{Array.from({ length: 24 }, (_, hour) => { const difference = offsetHours(new Date(anchor), secondaryTimezone) - offsetHours(new Date(anchor), primaryTimezone); const pakistanHour = (hour + difference + 24) % 24; return <div className="bd-mini-time-row" data-hour={hour} data-testid="bd-mini-time-row" key={hour}><time><strong>{String(hour).padStart(2, "0")}:00</strong><small>{String(pakistanHour).padStart(2, "0")}:00</small></time><div>{selectedDayEvents.filter((interview) => hourInZone(interview.startsAt) === hour).map((interview) => <a className="bd-mini-calendar-event" href={`/leads/${interview.leadId}/interviews?edit=${interview.id}`} key={interview.id}><strong>{clockFor(interview.startsAt)} · {interview.roundType.replaceAll("_", " ")}</strong><span>Round {interview.roundNumber}</span></a>)}</div></div>; })}</div> : <div className={`bd-mini-calendar-view bd-mini-calendar-view-${view}`} data-testid="bd-mini-calendar-view"><div className="bd-mini-calendar-weekdays">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <span data-testid="bd-mini-calendar-weekday" key={day}>{day}</span>)}</div><div className={`bd-mini-calendar-grid ${view === "week" ? "bd-mini-week-grid" : ""}`} data-testid={view === "week" ? "bd-mini-week-grid" : undefined}>{viewDates.map((date) => { const items = interviewsFor(interviews, date); const outside = view === "month" && date.getUTCMonth() !== monthStart.getUTCMonth(); const isToday = calendarKey(date) === calendarKey(now); return <div className={`bd-mini-calendar-date ${outside ? "is-outside" : ""} ${isToday ? "is-today" : ""}`} data-testid="bd-mini-calendar-date" key={`${calendarKey(date)}-${view}`}><span className="bd-mini-calendar-date-number">{view === "month" ? date.getUTCDate() : calendarLabelFor(date, { weekday: "short", day: "numeric" })}</span>{items.length ? <a className="bd-mini-calendar-count" aria-label={`${items.length} interviews on ${calendarKey(date)}`} href={`/leads/${items[0]!.leadId}/interviews?edit=${items[0]!.id}`}>{items.length}</a> : null}{view === "week" && items.map((interview) => <a className="bd-mini-calendar-event" href={`/leads/${interview.leadId}/interviews?edit=${interview.id}`} key={interview.id}><strong>{clockFor(interview.startsAt)}</strong><span>{interview.roundType.replaceAll("_", " ")}</span></a>)}</div>; })}</div></div>}
  </Card>;
}
