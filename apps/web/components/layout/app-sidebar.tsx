"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import type { UserRole } from "@orbit/contracts";
import { Button } from "@orbit/ui";

export type NavigationItem = {
  group?: string;
  href: string;
  label: string;
  icon: "dashboard" | "candidates" | "profiles" | "leads" | "calendar" | "tasks" | "analytics" | "activity" | "admin";
};

function NavIcon({ name }: { name: NavigationItem["icon"] }) {
  const paths = {
    dashboard: "M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 0h6v6h-6v-6Z",
    candidates: "M8.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM3 20v-2a5.5 5.5 0 0 1 11 0v2m4-8v6m-3-3h6",
    profiles: "M8.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm7-1a3 3 0 1 0 0-6M3 20v-2a5.5 5.5 0 0 1 11 0v2m1-7a5 5 0 0 1 5 5v2",
    leads: "M5 5h14v14H5V5Zm3 4h8m-8 4h8m-8 4h5",
    calendar: "M5 4h14v16H5V4Zm3-2v4m8-4v4M5 9h14m-9 4h.01m4 0h.01m-4 4h.01m4 0h.01",
    tasks: "M5 5h14v14H5V5Zm3 4 1.5 1.5L13 7m-5 6 1.5 1.5L13 11m3-2h2m-2 4h2",
    analytics: "M5 19V10m7 9V5m7 14v-7",
    activity: "M4 12h3l2-5 4 10 2-5h5",
    admin: "M12 3 5 6v5c0 4.5 2.7 8 7 10 4.3-2 7-5.5 7-10V6l-7-3Zm0 6v4m0 3v.01",
  };

  return (
    <svg aria-hidden="true" className="size-[18px]" fill="none" viewBox="0 0 24 24">
      <path d={paths[name]} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
    </svg>
  );
}

export function AppSidebar({
  collapsed,
  items,
  onCollapsedChange,
  role,
}: {
  collapsed: boolean;
  items: NavigationItem[];
  onCollapsedChange: (collapsed: boolean) => void;
  role: UserRole;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  return (
    <>
      <button
        aria-label="Open navigation"
        className={`fixed left-4 top-3.5 z-40 grid size-9 place-items-center rounded-xl border border-border bg-surface text-foreground shadow-sm lg:hidden ${mobileOpen ? "hidden" : "grid"}`}
        onClick={() => setMobileOpen(true)}
        type="button"
      >
        <span aria-hidden="true">☰</span>
      </button>
      {mobileOpen ? <button aria-label="Close navigation overlay" className="fixed inset-0 z-30 bg-sidebar/45 backdrop-blur-[1px] lg:hidden" onClick={() => setMobileOpen(false)} type="button" /> : null}
      <aside
      className={`fixed inset-y-0 left-0 z-40 flex border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width,transform] duration-200 motion-reduce:transition-none lg:translate-x-0 ${collapsed ? "w-[76px]" : "w-[248px]"} ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-5">
          <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-primary text-sm font-black text-white shadow-[0_5px_12px_rgba(10,51,237,0.2)]">O</span>
          {!collapsed ? (
            <div className="min-w-0">
              <p className="text-sm font-bold tracking-wide text-sidebar-foreground">ORBIT</p>
              <p className="truncate text-[10px] font-medium uppercase tracking-[0.18em] text-sidebar-muted">Placement CRM</p>
            </div>
          ) : null}
          <Button
            aria-label="Close navigation"
            className="ml-auto text-sidebar-muted hover:bg-white/10 hover:text-white lg:hidden"
            onClick={() => setMobileOpen(false)}
            size="icon"
            variant="ghost"
          >
            <span aria-hidden="true">×</span>
          </Button>
        </div>

        <nav aria-label="Primary navigation" className="flex-1 space-y-1 px-3 py-5">
          {items.map((item, index) => (
            <div key={item.href}>
            {!collapsed && (index === 0 || item.group !== items[index - 1]?.group) ? <p className="mb-2 mt-5 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-sidebar-muted first:mt-0">{item.group}</p> : null}
            {(() => {
              const active = item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
            <Link
              aria-current={active ? "page" : undefined}
              className={`flex h-10 items-center gap-3 rounded-xl border px-3 text-sm font-medium transition-colors motion-reduce:transition-none ${active ? "border-primary/15 bg-primary-soft font-semibold text-primary" : "border-transparent text-sidebar-muted hover:bg-surface-subtle hover:text-sidebar-foreground"}`}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              title={collapsed ? item.label : undefined}
            >
              <span className="grid size-5 shrink-0 place-items-center"><NavIcon name={item.icon} /></span>
              {!collapsed ? <span>{item.label}</span> : <span className="sr-only">{item.label}</span>}
            </Link>
              );
            })()}
            </div>
          ))}
        </nav>

        <div className="border-t border-sidebar-border p-3">
          {!collapsed ? (
            <div className="mb-3 rounded-xl border border-sidebar-border bg-surface-subtle px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-muted">Workspace</p>
              <p className="mt-1 text-xs font-medium text-sidebar-foreground">{role === "ADMIN" ? "Platform operations" : role === "BD" ? "Placement operations" : "Interview workspace"}</p>
            </div>
          ) : null}
          <Button
            aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
            className="hidden w-full text-sidebar-muted hover:bg-white/10 hover:text-white lg:inline-flex"
            onClick={() => onCollapsedChange(!collapsed)}
            size={collapsed ? "icon" : "sm"}
            variant="ghost"
          >
            <span aria-hidden="true">{collapsed ? "→" : "←"}</span>
            {!collapsed ? "Collapse" : null}
          </Button>
        </div>
        </div>
      </aside>
    </>
  );
}
