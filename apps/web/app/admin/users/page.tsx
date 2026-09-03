import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { UsersPage } from "../../../components/admin/users-page";
import { AppShell } from "../../../components/layout/app-shell";
import { getCurrentActor } from "../../../lib/api-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Users" };

export default async function AdminUsersRoute() {
  const cookie = (await headers()).get("cookie") ?? undefined;
  const actor = await getCurrentActor(cookie);
  if (!actor) redirect("/login");

  return (
    <AppShell actor={actor}>
      <UsersPage actor={actor} />
    </AppShell>
  );
}
