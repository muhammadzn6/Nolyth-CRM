import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { AppShell } from "../../components/layout/app-shell";
import { PasswordForm } from "../../components/settings/password-form";
import { getCurrentActor } from "../../lib/api-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Account settings" };

export default async function SettingsPage() {
  const actor = await getCurrentActor((await headers()).get("cookie") ?? undefined);
  if (!actor) redirect("/login");

  return <AppShell actor={actor}><div className="mx-auto grid max-w-[900px] gap-5"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Account</p><div className="mt-2 flex items-center gap-3"><span aria-hidden="true" className="grid size-9 place-items-center rounded-full bg-primary-soft text-sm font-bold text-primary">⚙</span><h1 className="text-2xl font-bold text-foreground sm:text-3xl">Account settings</h1></div><p className="sr-only">Manage your sign-in credentials for this Orbit workspace.</p></div><section className="rounded-[1.5rem] border border-border/80 bg-surface p-5 shadow-[0_14px_36px_rgba(35,42,58,0.04)] sm:p-7"><div className="flex items-start gap-3"><span aria-hidden="true" className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-action-soft text-sm font-bold text-action">•</span><div><h2 className="text-lg font-semibold text-foreground">Change password</h2><p className="sr-only">Use a unique password that you do not reuse elsewhere.</p></div></div><div className="mt-6 max-w-xl"><PasswordForm username={actor.email} /></div></section></div></AppShell>;
}
