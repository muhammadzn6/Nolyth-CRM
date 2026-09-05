import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { PerformanceRulesForm } from "../../../components/performance/performance-rules-form";
import { AppShell } from "../../../components/layout/app-shell";
import { getCurrentActor } from "../../../lib/api-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Performance rules" };

export default async function AdminPerformanceRoute() {
  const cookie = (await headers()).get("cookie") ?? undefined;
  const actor = await getCurrentActor(cookie);
  if (!actor) redirect("/login");
  if (actor.role !== "ADMIN" || !actor.isActive) redirect("/unauthorized");

  return (
    <AppShell actor={actor}>
      <PerformanceRulesForm actor={actor} />
    </AppShell>
  );
}
