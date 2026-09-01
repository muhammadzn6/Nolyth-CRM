import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { requireActiveUser } from "@/lib/auth/session";
import type { AppActor } from "@/types/auth";

export const dynamic = "force-dynamic";

async function getAuthenticatedUser(): Promise<AppActor> {
  try {
    return await requireActiveUser();
  } catch {
    redirect("/login");
  }
}

export default async function ApplicationLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await getAuthenticatedUser();
  return <AppShell user={user}>{children}</AppShell>;
}
