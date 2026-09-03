import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "../../../../components/layout/app-shell";
import { ClientForm } from "../../../../components/clients/client-form";
import { getCurrentActor } from "../../../../lib/api-client";

export const metadata: Metadata = { title: "New employer" };
export default async function NewClientRoute() {
  const actor = await getCurrentActor((await headers()).get("cookie") ?? undefined);
  if (!actor) redirect("/login");
  if (actor.role !== "ADMIN") redirect("/unauthorized");
  return <AppShell actor={actor}><div className="mx-auto grid max-w-[900px] gap-5"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Employer operations</p><h1 className="mt-2 text-2xl font-bold text-foreground">New employer</h1></div><ClientForm /></div></AppShell>;
}
