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

  return <AppShell actor={actor}><div className="mx-auto grid max-w-[900px] gap-5"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Account</p><h1 className="mt-2 text-2xl font-bold text-foreground sm:text-3xl">Account settings</h1><p className="mt-1.5 text-sm text-muted-foreground">Manage your sign-in credentials for this Orbit workspace.</p></div><section className="rounded-xl border border-border/80 bg-surface p-5 sm:p-7"><h2 className="text-lg font-semibold text-foreground">Change password</h2><p className="mt-1 text-sm text-muted-foreground">Use a unique password that you do not reuse elsewhere.</p><div className="mt-6 max-w-xl"><PasswordForm /></div></section></div></AppShell>;
}
