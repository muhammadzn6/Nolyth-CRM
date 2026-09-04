"use client";

import { useState } from "react";
import type { ActivityEventSummary, InterviewSummary, TaskSummary } from "@orbit/contracts";
import { Card } from "@orbit/ui";

type Tab = "attention" | "today" | "activity";

function titleCase(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function DashboardSidePanel({ tasks, interviews, activity }: { tasks: TaskSummary[]; interviews: InterviewSummary[]; activity: ActivityEventSummary[] }) {
  const [tab, setTab] = useState<Tab>("attention");
  const conflicts = interviews.filter((interview) => interview.status === "RESCHEDULE_REQUIRED");
  const attention = [
    ...conflicts.map((interview) => ({ id: `conflict-${interview.id}`, title: "Scheduling conflict", detail: `${titleCase(interview.roundType)} · reschedule required`, tone: "danger" })),
    ...tasks.filter((task) => new Date(task.dueAt) < new Date()).map((task) => ({ id: `task-${task.id}`, title: "Overdue action", detail: task.title, tone: "warning" })),
  ];
  return <Card aria-label="Dashboard activity panel" className="overflow-hidden p-0"><div className="grid grid-cols-3 border-b border-border text-xs font-semibold"><button aria-selected={tab === "attention"} className={`px-3 py-3 ${tab === "attention" ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`} onClick={() => setTab("attention")} role="tab" type="button">Needs attention <span className="ml-1 rounded-full bg-danger-soft px-1.5 py-0.5 text-[10px] text-danger">{attention.length}</span></button><button aria-selected={tab === "today"} className={`px-3 py-3 ${tab === "today" ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`} onClick={() => setTab("today")} role="tab" type="button">Today <span className="ml-1 rounded-full bg-info-soft px-1.5 py-0.5 text-[10px] text-info">{interviews.length}</span></button><button aria-selected={tab === "activity"} className={`px-3 py-3 ${tab === "activity" ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`} onClick={() => setTab("activity")} role="tab" type="button">Live activity</button></div><div className="max-h-[520px] overflow-y-auto p-3">{tab === "attention" ? <div className="space-y-2">{attention.length ? attention.map((item) => <a className="block rounded-lg border border-border p-3 transition hover:border-primary/40 hover:bg-surface-subtle" href={item.title === "Scheduling conflict" ? "/calendar" : "/tasks"} key={item.id}><p className="text-sm font-semibold text-foreground"><span className={`mr-2 inline-block size-2 rounded-full ${item.tone === "danger" ? "bg-danger" : "bg-warning"}`} />{item.title}</p><p className="mt-1 text-xs text-muted-foreground">{item.detail}</p></a>) : <p className="py-8 text-center text-sm text-muted-foreground">Nothing needs attention.</p>}</div> : tab === "today" ? <div className="space-y-2">{interviews.length ? interviews.map((interview) => <a className="block rounded-lg border border-border p-3 hover:bg-surface-subtle" href={`/leads/${interview.leadId}`} key={interview.id}><p className="text-sm font-semibold text-foreground">{titleCase(interview.roundType)} · Round {interview.roundNumber}</p><p className="mt-1 text-xs text-muted-foreground">{new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(interview.startsAt))} · {titleCase(interview.status)}</p></a>) : <p className="py-8 text-center text-sm text-muted-foreground">No interviews in this view.</p>}</div> : <div className="space-y-2">{activity.length ? activity.slice(0, 8).map((event) => <div className="border-b border-border py-3 first:pt-0 last:border-0" key={event.id}><p className="text-sm font-semibold text-foreground">{titleCase(event.action)}</p><p className="mt-1 text-xs text-muted-foreground">{event.actorNameSnapshot ?? "Orbit"} · {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(event.occurredAt))}</p></div>) : <p className="py-8 text-center text-sm text-muted-foreground">No recent activity.</p>}</div>}</div></Card>;
}
