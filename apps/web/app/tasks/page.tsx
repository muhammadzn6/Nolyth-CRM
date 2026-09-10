import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Button, Card, EmptyState, ErrorState, Field, Input } from "@orbit/ui";
import { AppShell } from "../../components/layout/app-shell";
import { ApiClientError, getCurrentActor, listTasks } from "../../lib/api-client";
import { TaskActions } from "../../components/tasks/task-actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Tasks" };

function formatDue(value: string) { return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }

export default async function TasksRoute({ searchParams }: { searchParams?: Promise<{ search?: string }> }) {
  const cookie = (await headers()).get("cookie") ?? undefined;
  const actor = await getCurrentActor(cookie);
  if (!actor) redirect("/login");
  const search = (await searchParams)?.search?.trim() ?? "";
  let tasks;
  try { tasks = await listTasks({ status: "OPEN", ...(search ? { search } : {}) }, cookie); }
  catch (reason) { return <AppShell actor={actor}><ErrorState description={reason instanceof ApiClientError ? reason.message : "Orbit could not load tasks."} title="Tasks unavailable" /></AppShell>; }
  const highPriority = tasks.filter((task) => task.priority === "HIGH").length;
  return <AppShell actor={actor}><div className="mx-auto grid max-w-[1500px] gap-5"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Work queue</p><h1 className="mt-2 text-2xl font-bold tracking-[-0.03em] text-foreground sm:text-3xl">Tasks</h1></div><div className="flex gap-2 text-xs"><span className="rounded-full bg-surface px-3 py-2 font-semibold text-foreground shadow-sm" title="Open tasks">{tasks.length}</span>{highPriority ? <span className="inline-flex items-center gap-1.5 rounded-full bg-danger-soft px-3 py-2 font-semibold text-danger" title="High-priority tasks"><span aria-hidden="true">!</span>{highPriority}</span> : null}</div></div><Card className="p-4 sm:p-5"><form action="/tasks" aria-label="Search tasks" className="flex flex-col gap-3 sm:flex-row sm:items-end" method="get"><Field className="min-w-0 flex-1" htmlFor="task-search" label="Find work"><Input defaultValue={search} id="task-search" name="search" placeholder="Search title, candidate, profile, type, or priority" type="search" /></Field><div className="flex gap-2"><Button type="submit" variant="secondary">Search</Button>{search ? <Link className="inline-flex h-10 items-center justify-center rounded-xl px-3 text-sm font-semibold text-muted-foreground hover:bg-surface-subtle hover:text-foreground" href="/tasks">Clear</Link> : null}</div></form></Card>{tasks.length === 0 ? <EmptyState description={search ? "Try another title, candidate, profile, type, or priority." : "New follow-ups and preparation work will appear here."} title={search ? "No tasks match this search" : "No open tasks"} /> : <Card className="overflow-hidden p-0"><div className="border-b border-border bg-surface-subtle px-5 py-3 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground" title="Open tasks ordered by due date">Open queue · due first</div><section aria-label="Open tasks" className="data-scroll-region max-h-[calc(100vh-22rem)] min-h-[22rem] divide-y divide-border overflow-y-auto">{tasks.map((task) => <article className="grid gap-4 px-5 py-4 transition-colors hover:bg-primary/5 lg:grid-cols-[minmax(0,1.4fr)_minmax(180px,0.55fr)_auto] lg:items-center" key={task.id}><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="truncate text-sm font-bold text-foreground">{task.title}</h2><span title={task.priority} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${task.priority === "HIGH" ? "bg-danger-soft text-danger" : task.priority === "LOW" ? "bg-surface-subtle text-muted-foreground" : "bg-warning-soft text-warning-foreground"}`}><span aria-hidden="true">{task.priority === "HIGH" ? "!" : task.priority === "LOW" ? "·" : "◷"}</span>{task.priority}</span></div><p className="mt-1 text-xs font-semibold uppercase tracking-[0.08em] text-primary" title={task.type.replaceAll("_", " ")}>{task.type.replaceAll("_", " ")}</p>{task.description ? <p className="mt-2 line-clamp-2 text-sm text-muted-foreground" title={task.description}>{task.description}</p> : null}</div><p className="text-sm text-muted-foreground" title={`Due ${formatDue(task.dueAt)}`}><span className="block text-[10px] font-bold uppercase tracking-[0.1em]">Due</span><time className="mt-1 block font-semibold text-foreground"><span aria-hidden="true" className="mr-1.5 text-primary">◷</span>{formatDue(task.dueAt)}</time></p><TaskActions taskId={task.id} version={task.version} /></article>)}</section></Card>}</div></AppShell>;
}
