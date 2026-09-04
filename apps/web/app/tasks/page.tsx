import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Card, EmptyState, ErrorState } from "@orbit/ui";
import { AppShell } from "../../components/layout/app-shell";
import { ApiClientError, getCurrentActor, listTasks } from "../../lib/api-client";
import { TaskActions } from "../../components/tasks/task-actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Work queue" };

function formatDue(value: string) { return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }

export default async function TasksRoute() {
  const cookie = (await headers()).get("cookie") ?? undefined;
  const actor = await getCurrentActor(cookie);
  if (!actor) redirect("/login");
  let tasks;
  try { tasks = await listTasks({ status: "OPEN" }, cookie); }
  catch (reason) { return <AppShell actor={actor}><ErrorState description={reason instanceof ApiClientError ? reason.message : "Orbit could not load the work queue."} title="Work queue unavailable" /></AppShell>; }
  return <AppShell actor={actor}><div className="mx-auto grid max-w-[1100px] gap-5"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Work queue</p><h1 className="mt-2 text-2xl font-bold text-foreground sm:text-3xl">Work queue</h1><p className="mt-1.5 text-sm text-muted-foreground">Actions assigned to you that need a clear next step.</p></div>{tasks.length === 0 ? <EmptyState description="New follow-ups and preparation work will appear here." title="Queue is clear" /> : <section aria-label="Open work items" className="grid gap-3">{tasks.map((task) => <Card className="p-5" key={task.id}><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">{task.type.replaceAll("_", " ")}</p><h2 className="mt-2 text-base font-bold text-foreground">{task.title}</h2><p className="mt-1 text-sm text-muted-foreground">Due {formatDue(task.dueAt)} · Profile linked</p></div><span className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${task.priority === "HIGH" ? "bg-danger-soft text-danger" : task.priority === "LOW" ? "bg-surface-subtle text-muted-foreground" : "bg-warning-soft text-warning-foreground"}`}>{task.priority}</span></div>{task.description ? <p className="mt-4 text-sm text-muted-foreground">{task.description}</p> : null}<TaskActions taskId={task.id} version={task.version} /></Card>)}</section>}</div></AppShell>;
}
