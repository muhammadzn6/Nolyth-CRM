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
  const tabs: Array<{ key: Tab; label: string; icon: string; count?: number }> = [
    { key: "attention", label: "Attention", icon: "!", count: attention.length },
    { key: "today", label: "Today", icon: "◷", count: interviews.length },
    { key: "activity", label: "Live", icon: "·" },
  ];

  return <Card aria-label="Dashboard activity panel" className="overflow-hidden p-0">
    <div className="grid grid-cols-3 border-b border-border text-xs font-semibold">
      {tabs.map((item) => <button aria-label={item.label} aria-selected={tab === item.key} className={`flex items-center justify-center gap-1.5 px-3 py-3 ${tab === item.key ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`} onClick={() => setTab(item.key)} role="tab" title={item.label} type="button" key={item.key}>
        <span aria-hidden="true" className="grid size-4 place-items-center rounded-full bg-current/10 text-[10px] font-black">{item.icon}</span>
        <span>{item.label}</span>
        {item.count !== undefined ? <span className="rounded-full bg-surface-subtle px-1.5 py-0.5 text-[10px] tabular-nums">{item.count}</span> : null}
      </button>)}
    </div>
    <div className="max-h-[520px] overflow-y-auto p-3">
      {tab === "attention" ? <div className="space-y-2">{attention.length ? attention.map((item) => <a className="block rounded-lg border border-border p-3 transition hover:border-primary/40 hover:bg-surface-subtle" href={item.title === "Scheduling conflict" ? "/?calendarView=day" : "/tasks"} key={item.id}><p className="text-sm font-semibold text-foreground"><span aria-hidden="true" className={`mr-2 inline-grid size-5 place-items-center rounded-full text-xs font-black text-white ${item.tone === "danger" ? "bg-danger" : "bg-warning"}`}>{item.tone === "danger" ? "!" : "→"}</span>{item.title}</p><p className="mt-1 text-xs text-muted-foreground">{item.detail}</p></a>) : <p className="py-8 text-center text-sm text-muted-foreground">Clear</p>}</div> : tab === "today" ? <div className="space-y-2">{interviews.length ? interviews.map((interview) => <a className="block rounded-lg border border-border p-3 hover:bg-surface-subtle" href={`/leads/${interview.leadId}`} key={interview.id}><p className="text-sm font-semibold text-foreground">{titleCase(interview.roundType)} · R{interview.roundNumber}</p><p className="mt-1 text-xs text-muted-foreground">{new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "numeric", hour12: false }).format(new Date(interview.startsAt))} · {titleCase(interview.status)}</p></a>) : <p className="py-8 text-center text-sm text-muted-foreground">Clear</p>}</div> : <div className="space-y-2">{activity.length ? activity.slice(0, 8).map((event) => <div className="border-b border-border py-3 first:pt-0 last:border-0" key={event.id}><p className="text-sm font-semibold text-foreground">{titleCase(event.action)}</p><p className="mt-1 text-xs text-muted-foreground">{event.actorNameSnapshot ?? "Orbit"} · {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(event.occurredAt))}</p></div>) : <p className="py-8 text-center text-sm text-muted-foreground">Clear</p>}</div>}
    </div>
  </Card>;
}
