import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Card, EmptyState, ErrorState } from "@orbit/ui";
import { AppShell } from "../../components/layout/app-shell";
import { ApiClientError, getCurrentActor, listNotifications } from "../../lib/api-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsRoute() {
  const cookie = (await headers()).get("cookie") ?? undefined;
  const actor = await getCurrentActor(cookie);
  if (!actor) redirect("/login");
  let notifications;
  try { notifications = await listNotifications({}, cookie); }
  catch (reason) { return <AppShell actor={actor}><ErrorState description={reason instanceof ApiClientError ? reason.message : "Orbit could not load notifications."} title="Notifications unavailable" /></AppShell>; }
  return <AppShell actor={actor}><div className="mx-auto grid max-w-[900px] gap-5"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Inbox</p><h1 className="mt-2 text-2xl font-bold text-foreground sm:text-3xl">Notifications</h1><p className="mt-1.5 text-sm text-muted-foreground">Updates about work that needs your attention.</p></div>{notifications.length === 0 ? <EmptyState description="You are all caught up." title="No notifications" /> : <Card className="divide-y divide-border overflow-hidden p-0">{notifications.map((notification) => <article className={`flex gap-4 px-5 py-4 ${notification.readAt ? "" : "bg-primary-soft/35"}`} key={notification.id}><span className={`mt-1.5 size-2 shrink-0 rounded-full ${notification.readAt ? "bg-border-strong" : "bg-primary"}`} title={notification.readAt ? undefined : "Unread"} /><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-foreground">{notification.title}</p><p className="mt-1 text-sm text-muted-foreground">{notification.message}</p><time className="mt-2 block text-xs text-muted-foreground">{new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(notification.createdAt))}</time></div></article>)}</Card>}</div></AppShell>;
}
