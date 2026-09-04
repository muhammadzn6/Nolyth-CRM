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
      className={`fixed inset-y-3 left-3 z-40 flex rounded-[2rem] border border-border/80 bg-surface text-foreground shadow-[0_12px_32px_rgba(35,42,58,0.06)] transition-[width,transform] duration-200 motion-reduce:transition-none lg:inset-y-24 lg:left-4 lg:translate-x-0 ${collapsed ? "w-[76px]" : "w-[224px]"} ${mobileOpen ? "translate-x-0" : "-translate-x-[120%]"}`}
      >
        <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-12 items-center justify-center px-3">
          <Link aria-label="Create lead" className="grid size-9 place-items-center rounded-full bg-foreground text-xl leading-none text-white transition hover:bg-primary focus-visible:ring-2 focus-visible:ring-focus" href="/leads">
            <span aria-hidden="true">+</span>
          </Link>
          <Button
            aria-label="Close navigation"
              className="ml-auto text-muted-foreground hover:bg-surface-subtle hover:text-foreground lg:hidden"
            onClick={() => setMobileOpen(false)}
            size="icon"
            variant="ghost"
          >
            <span aria-hidden="true">×</span>
          </Button>
        </div>

        <nav aria-label="Primary navigation" className="flex-1 space-y-1 px-3 py-4">
          {items.map((item, index) => (
            <div key={item.href}>
            {(index === 0 || item.group !== items[index - 1]?.group) ? <p className={`${collapsed ? "sr-only" : "mb-2 mt-5 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground first:mt-0"}`}>{item.group}</p> : null}
            {(() => {
              const active = item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
            <Link
              aria-current={active ? "page" : undefined}
              className={`flex h-10 items-center gap-3 rounded-full border px-3 text-sm font-medium transition-colors motion-reduce:transition-none ${collapsed ? "justify-center" : ""} ${active ? "border-foreground bg-foreground font-semibold text-white" : "border-transparent text-muted-foreground hover:bg-surface-subtle hover:text-foreground"}`}
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
            className="hidden w-full text-muted-foreground hover:bg-surface-subtle hover:text-foreground lg:inline-flex"
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
