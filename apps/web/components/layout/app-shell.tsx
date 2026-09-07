"use client";

import { useState, type ReactNode } from "react";
import type { SessionUser } from "@orbit/contracts";

import { AppHeader } from "./app-header";
import { AppSidebar, type NavigationItem } from "./app-sidebar";

const navigation: Array<NavigationItem & { group: string; roles: SessionUser["role"][] }> = [
  { group: "Command center", href: "/", label: "Dashboard", icon: "dashboard", roles: ["ADMIN", "BD", "CLOSER"] },
  { group: "Recruitment", href: "/candidates", label: "Candidates", icon: "candidates", roles: ["ADMIN"] },
  { group: "Recruitment", href: "/profiles", label: "Profiles", icon: "profiles", roles: ["ADMIN", "BD"] },
  { group: "Recruitment", href: "/leads", label: "Leads", icon: "leads", roles: ["ADMIN", "BD", "CLOSER"] },
  { group: "Recruitment", href: "/tasks", label: "Tasks", icon: "tasks", roles: ["ADMIN", "BD", "CLOSER"] },
  { group: "Insights", href: "/analytics", label: "Analytics", icon: "analytics", roles: ["ADMIN", "BD"] },
  { group: "Insights", href: "/activity", label: "Activity", icon: "activity", roles: ["ADMIN", "BD", "CLOSER"] },
  { group: "Administration", href: "/admin/users", label: "Users", icon: "admin", roles: ["ADMIN"] },
  { group: "Account", href: "/settings", label: "Account settings", icon: "admin", roles: ["ADMIN", "BD", "CLOSER"] },
];

export function AppShell({ actor, children }: { actor: SessionUser; children: ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const items = navigation
    .filter((item) => item.roles.includes(actor.role))
    .map(({ roles: _roles, ...item }) => item);

  return (
    <div className="app-shell min-h-screen bg-background">
      <AppSidebar
        collapsed={sidebarCollapsed}
        items={items}
        mobileOpen={mobileNavigationOpen}
        onCollapsedChange={setSidebarCollapsed}
        onMobileOpenChange={setMobileNavigationOpen}
        role={actor.role}
      />
      <div className={`min-h-screen transition-[padding] duration-200 motion-reduce:transition-none ${sidebarCollapsed ? "lg:pl-[96px]" : "lg:pl-[248px]"}`}>
        <AppHeader actor={actor} onNavigationToggle={() => setMobileNavigationOpen((value) => !value)} />
        <main className="px-4 pb-8 pt-5 md:px-7 lg:px-9 lg:pb-10 lg:pt-7">{children}</main>
      </div>
    </div>
  );
}
