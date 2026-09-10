import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Card, EmptyState, ErrorState } from "@orbit/ui";
import { AppShell } from "../../components/layout/app-shell";
import { ApiClientError, getCurrentActor, listNotifications } from "../../lib/api-client";

function notificationGlyph(type: string): string {
  const value = type.toLowerCase();
  if (value.includes("interview") || value.includes("calendar")) return "◷";
  if (value.includes("task") || value.includes("follow")) return "✓";
  if (value.includes("response") || value.includes("communication")) return "↗";
  return "!";
}

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsRoute({ searchParams }: { searchParams?: Promise<{ unread?: string }> }) {
  const cookie = (await headers()).get("cookie") ?? undefined;
  const actor = await getCurrentActor(cookie);
  if (!actor) redirect("/login");
  const unreadOnly = (await searchParams)?.unread === "1";
  let notifications;
  try { notifications = await listNotifications({ unreadOnly }, cookie); }
  catch (reason) { return <AppShell actor={actor}><ErrorState description={reason instanceof ApiClientError ? reason.message : "Orbit could not load notifications."} title="Notifications unavailable" /></AppShell>; }
  return <AppShell actor={actor}><div className="mx-auto grid max-w-[900px] gap-5"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Inbox</p><h1 className="mt-1.5 text-2xl font-bold text-foreground sm:text-3xl">Notifications</h1><p className="sr-only">Updates about work that needs your attention.</p></div><nav aria-label="Notification filter" className="inline-flex w-fit rounded-xl border border-border bg-surface p-1 text-xs font-semibold"><Link className={`rounded-lg px-3 py-2 ${!unreadOnly ? "bg-action text-action-foreground" : "text-muted-foreground hover:text-foreground"}`} href="/notifications">All</Link><Link className={`rounded-lg px-3 py-2 ${unreadOnly ? "bg-action text-action-foreground" : "text-muted-foreground hover:text-foreground"}`} href="/notifications?unread=1">Unread</Link></nav></div>{notifications.length === 0 ? <EmptyState description={unreadOnly ? "You have no unread notifications." : "You are all caught up."} title={unreadOnly ? "No unread notifications" : "No notifications"} /> : <Card className="overflow-hidden p-0"><div className="data-scroll-region max-h-[calc(100vh-14rem)] min-h-[24rem] divide-y divide-border overflow-y-auto">{notifications.map((notification) => <article className={`flex gap-3 px-5 py-4 ${notification.readAt ? "" : "bg-primary-soft/35"}`} key={notification.id}><span aria-hidden="true" className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${notification.readAt ? "bg-surface-subtle text-muted-foreground" : "bg-primary text-primary-foreground"}`} title={`${notification.type}${notification.readAt ? " · Read" : " · Unread"}`}>{notificationGlyph(notification.type)}</span><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><p className="text-sm font-semibold text-foreground">{notification.title}</p><time className="shrink-0 text-xs text-muted-foreground" dateTime={notification.createdAt} title={new Date(notification.createdAt).toLocaleString()}>{new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(notification.createdAt))}</time></div><p className="mt-1 text-sm text-muted-foreground" title={notification.message}>{notification.message}</p></div></article>)}</div></Card>}</div></AppShell>;
}
