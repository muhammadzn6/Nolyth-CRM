import type { ReactNode } from "react";

import type { AppActor } from "@/types/auth";

import { AppSidebar } from "@/components/layout/app-sidebar";

export function AppShell({
  user,
  children,
}: {
  user: AppActor;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background lg:flex-row">
      <AppSidebar user={user} />
      <main className="min-h-0 min-w-0 flex-1 overflow-auto px-4 py-5 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
