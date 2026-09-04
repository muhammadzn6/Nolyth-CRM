import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button, ErrorState } from "@orbit/ui";
import { AppShell } from "../../../components/layout/app-shell";
import { ClientDirectory } from "../../../components/clients/client-directory";
import { ApiClientError, getCurrentActor, listCompanies } from "../../../lib/api-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Employers" };

export default async function ClientsRoute() {
  const cookie = (await headers()).get("cookie") ?? undefined; const actor = await getCurrentActor(cookie);
  if (!actor) redirect("/login"); if (actor.role !== "ADMIN") redirect("/unauthorized");
  try {
    const companies = await listCompanies(cookie);
    return <AppShell actor={actor}><div className="mx-auto grid max-w-[1200px] gap-5"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Employer operations</p><h1 className="mt-2 text-2xl font-bold text-foreground sm:text-3xl">Employers</h1><p className="mt-1.5 text-sm text-muted-foreground">Maintain the employers attached to job applications and reporting.</p></div><Link href="/admin/clients/new"><Button>New employer</Button></Link></div><ClientDirectory companies={companies} /></div></AppShell>;
  } catch (reason) { return <AppShell actor={actor}><ErrorState description={reason instanceof ApiClientError ? reason.message : "Orbit could not load employers."} title="Employers unavailable" /></AppShell>; }
}
