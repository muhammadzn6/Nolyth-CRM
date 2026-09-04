import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "../../../../../components/layout/app-shell";
import { ClientForm } from "../../../../../components/clients/client-form";
import { getCurrentActor, listCompanies } from "../../../../../lib/api-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Edit employer" };

export default async function EditClientRoute({ params }: { params: Promise<{ clientId: string }> }) {
  const cookie = (await headers()).get("cookie") ?? undefined;
  const actor = await getCurrentActor(cookie);
  if (!actor) redirect("/login");
  if (actor.role !== "ADMIN") redirect("/unauthorized");
  const { clientId } = await params;
  const company = (await listCompanies(cookie)).find((item) => item.id === clientId);
  if (!company) notFound();
  return <AppShell actor={actor}><div className="mx-auto grid max-w-[900px] gap-5"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Employer operations</p><h1 className="mt-2 text-2xl font-bold text-foreground">Edit {company.canonicalName}</h1></div><ClientForm initial={company} /></div></AppShell>;
}
