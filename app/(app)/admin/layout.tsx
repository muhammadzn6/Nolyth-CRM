import type { ReactNode } from "react";
import { notFound } from "next/navigation";

import { requireActiveUser } from "@/lib/auth/session";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const actor = await requireActiveUser();

  if (actor.role !== "ADMIN") {
    notFound();
  }

  return children;
}
