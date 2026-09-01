"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  ContactRound,
  LayoutDashboard,
  Menu,
  UserCog,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";

import { OrbitLogo } from "@/components/brand/orbit-logo";
import type { Role } from "@/constants/roles";
import { SidebarUserMenu } from "@/components/layout/sidebar-user-menu";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { useSidebarCollapsed } from "@/lib/hooks/use-sidebar-collapsed";
import { cn } from "@/lib/utils/cn";
import type { AppActor } from "@/types/auth";

type NavItem = {
  href: string;
  label: string;
  roles: Role[];
  icon: LucideIcon;
};

const navItems: NavItem[] = [
  { href: "/", label: "Dashboard", roles: ["ADMIN", "BD", "CLOSER"], icon: LayoutDashboard },
  { href: "/profiles", label: "Profiles", roles: ["ADMIN", "BD", "CLOSER"], icon: ContactRound },
  { href: "/activity", label: "Activity", roles: ["ADMIN", "BD", "CLOSER"], icon: Activity },
  { href: "/admin/users", label: "Users", roles: ["ADMIN"], icon: Users },
  { href: "/admin/profiles", label: "Admin Profiles", roles: ["ADMIN"], icon: UserCog },
];

const EXPANDED_WIDTH = 248;
const COLLAPSED_WIDTH = 76;

function NavLink({
  item,
  collapsed,
  active,
  onNavigate,
}: {
  item: NavItem;
  collapsed: boolean;
  active: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      className={cn(
        "group relative flex items-center rounded-2xl transition-all duration-200",
        collapsed ? "h-11 w-11 justify-center" : "gap-3 px-3 py-2.5",
        active ? "orbit-nav-active shadow-sm" : "orbit-nav-idle",
      )}
    >
      <Icon className="relative z-10 h-[18px] w-[18px] shrink-0 stroke-[1.75]" />
      {!collapsed ? (
        <span className="relative z-10 truncate text-sm font-medium">{item.label}</span>
      ) : null}
    </Link>
  );
}

function SidebarControls({
  collapsed,
  showCollapseToggle,
  onToggleCollapsed,
  onCloseMobile,
}: {
  collapsed: boolean;
  showCollapseToggle: boolean;
  onToggleCollapsed?: () => void;
  onCloseMobile?: () => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-1",
        collapsed ? "flex-col" : "justify-center",
      )}
    >
      <ThemeToggle collapsed={collapsed} />
      {showCollapseToggle ? (
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted transition-colors hover:bg-default hover:text-foreground"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      ) : null}
      {onCloseMobile ? (
        <button
          type="button"
          onClick={onCloseMobile}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-muted hover:bg-default hover:text-foreground"
          aria-label="Close menu"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}

function SidebarInner({
  user,
  collapsed,
  showCollapseToggle,
  onToggleCollapsed,
  onCloseMobile,
}: {
  user: AppActor;
  collapsed: boolean;
  showCollapseToggle: boolean;
  onToggleCollapsed?: () => void;
  onCloseMobile?: () => void;
}) {
  const pathname = usePathname() ?? "";
  const visibleNavItems = navItems.filter((item) => item.roles.includes(user.role));

  return (
    <div className="flex min-h-screen flex-col px-1">
      <div
        className={cn(
          "flex w-full shrink-0 pb-10 pt-4",
          collapsed ? "justify-center" : "justify-start",
        )}
      >
        <OrbitLogo
          height={collapsed ? 28 : 18}
          showWordmark={!collapsed}
          markOnly={collapsed}
        />
      </div>

      <nav
        className={cn(
          "flex flex-1 flex-col gap-1.5",
          collapsed ? "items-center" : "",
        )}
      >
        {visibleNavItems.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(`${item.href}/`));

          return (
            <NavLink
              key={`${item.href}-${item.label}`}
              item={item}
              collapsed={collapsed}
              active={active}
              onNavigate={onCloseMobile}
            />
          );
        })}
      </nav>

      <div className="mt-auto shrink-0 space-y-3 pb-4 pt-2">
        <SidebarControls
          collapsed={collapsed}
          showCollapseToggle={showCollapseToggle}
          onToggleCollapsed={onToggleCollapsed}
          onCloseMobile={onCloseMobile}
        />
        <SidebarUserMenu user={user} collapsed={collapsed} />
      </div>
    </div>
  );
}

export function AppSidebar({ user }: { user: AppActor }) {
  const { collapsed, toggleCollapsed, ready } = useSidebarCollapsed();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between bg-surface px-4 py-3 lg:hidden">
        <OrbitLogo height={22} showWordmark />
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-muted hover:bg-default hover:text-foreground"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      <motion.aside
        initial={false}
        animate={{
          width: ready ? (collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH) : EXPANDED_WIDTH,
        }}
        transition={{ type: "spring", stiffness: 380, damping: 34 }}
        className="orbit-sidebar-rail relative hidden min-h-screen shrink-0 overflow-hidden lg:flex lg:flex-col lg:px-2 lg:py-2"
      >
        <SidebarInner
          user={user}
          collapsed={collapsed}
          showCollapseToggle
          onToggleCollapsed={toggleCollapsed}
        />
      </motion.aside>

      <AnimatePresence>
        {mobileOpen ? (
          <>
            <motion.button
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
              aria-label="Close menu overlay"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", stiffness: 380, damping: 34 }}
              className="fixed inset-y-0 left-0 z-50 flex w-[248px] flex-col bg-surface px-3 py-4 shadow-overlay lg:hidden"
            >
              <SidebarInner
                user={user}
                collapsed={false}
                showCollapseToggle={false}
                onCloseMobile={() => setMobileOpen(false)}
              />
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>
    </>
  );
}
