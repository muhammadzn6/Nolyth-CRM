"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { usePathname, useRouter } from "next/navigation";

import type { SessionUser } from "@orbit/contracts";
import { logout } from "../../lib/api-client";

const roleLabels = { ADMIN: "Administrator", BD: "Business development", CLOSER: "Closer" } as const;
const quickActions = {
  ADMIN: [
    ["Add candidate", "/candidates?new=candidate"],
    ["Invite user", "/admin/users?new=user"],
  ],
  BD: [],
  CLOSER: [],
} as const;

type AppHeaderProps = {
  actor: SessionUser;
  onNavigationToggle?: () => void;
  onSidebarToggle?: () => void;
  sidebarCollapsed?: boolean;
};

export function AppHeader({
  actor,
  onNavigationToggle = () => undefined,
  onSidebarToggle = () => undefined,
  sidebarCollapsed = true,
}: AppHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [menuFocusTarget, setMenuFocusTarget] = useState<"first" | "last">("first");
  const [logoutError, setLogoutError] = useState<string>();
  const [logoutPending, setLogoutPending] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const signOutRef = useRef<HTMLButtonElement>(null);
  const actorQuickActions = quickActions[actor.role];
  const initials = actor.displayName
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("");
  const pageLabel = pathname === "/" ? "Dashboard" : pathname === "/admin/users" ? "Users" : pathname === "/calendar" ? "Dashboard calendar" : pathname.slice(1).split("/")[0]?.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) || "Workspace";

  useEffect(() => {
    if (!menuOpen) return;

    const items = menuRef.current?.querySelectorAll<HTMLElement>(
      '[role="menuitem"]:not([disabled])',
    );
    const target = menuFocusTarget === "first" ? items?.[0] : items?.[items.length - 1];
    target?.focus();
  }, [menuFocusTarget, menuOpen]);

  useEffect(() => {
    if (logoutError) signOutRef.current?.focus();
  }, [logoutError]);

  function openMenu(focusTarget: "first" | "last") {
    setMenuFocusTarget(focusTarget);
    setMenuOpen(true);
  }

  function closeMenu(returnFocus: boolean) {
    setMenuOpen(false);
    if (returnFocus) menuTriggerRef.current?.focus();
  }

  function toggleQuickMenu() {
    setMenuOpen(false);
    setQuickOpen((value) => !value);
  }

  function toggleAccountMenu() {
    setQuickOpen(false);
    if (menuOpen) closeMenu(false);
    else openMenu("first");
  }

  function handleMenuTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;

    event.preventDefault();
    openMenu(event.key === "ArrowDown" ? "first" : "last");
  }

  function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu(true);
      return;
    }

    if (event.key === "Tab") {
      closeMenu(false);
      return;
    }

    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;

    event.preventDefault();
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? [],
    );
    const currentIndex = items.indexOf(document.activeElement as HTMLElement);
    const offset = event.key === "ArrowDown" ? 1 : -1;
    const nextIndex = (currentIndex + offset + items.length) % items.length;
    items[nextIndex]?.focus();
  }

  async function handleLogout() {
    setLogoutError(undefined);
    setLogoutPending(true);

    try {
      await logout();
      router.replace("/login");
    } catch {
      setLogoutError("Could not sign out. Try again.");
      setLogoutPending(false);
    }
  }

  return (
    <header className="command-header" data-dashboard={pathname === "/" ? "true" : "false"} data-testid="command-header">
      <div className="command-header-leading">
        <button aria-label="Toggle navigation" className="command-circle-control lg:hidden" onClick={onNavigationToggle} type="button">
          <span aria-hidden="true" className="command-menu-icon"><i /><i /></span>
        </button>
        <button
          aria-label={sidebarCollapsed ? "Expand primary navigation" : "Collapse primary navigation"}
          className="command-circle-control hidden lg:grid"
          onClick={onSidebarToggle}
          type="button"
        >
          <span aria-hidden="true" className="command-menu-icon"><i /><i /></span>
        </button>
        <div className="command-brand" data-testid="command-brand">
          <span aria-hidden="true" className="command-brand-mark">O</span>
          <span className="min-w-0">
            <strong>Orbit</strong>
            <small>{pageLabel}</small>
          </span>
        </div>
      </div>

      <div className="command-header-utilities">
        {actorQuickActions.length > 0 ? <div className="relative hidden sm:block">
          <button aria-expanded={quickOpen} aria-haspopup="menu" aria-label="Quick add" className="command-circle-control command-quick-add" data-variant="quiet" onClick={toggleQuickMenu} title="Quick add" type="button"><span aria-hidden="true">＋</span></button>
          {quickOpen ? <div aria-label="Quick add menu" className="absolute right-0 top-14 w-56 rounded-2xl border border-border bg-surface p-2 shadow-[0_18px_48px_rgba(17,24,39,0.16)]" role="menu">{actorQuickActions.map(([label, href]) => <a className="flex min-h-10 items-center rounded-xl px-3 text-sm font-semibold text-foreground hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus" href={href} key={label} onClick={() => setQuickOpen(false)} role="menuitem">{label}</a>)}</div> : null}
        </div> : null}

        <div className="relative">
          <button aria-controls="user-menu" aria-expanded={menuOpen} aria-haspopup="menu" aria-label="Account menu" className="command-account" onClick={toggleAccountMenu} onKeyDown={handleMenuTriggerKeyDown} ref={menuTriggerRef} type="button">
            <span className="command-avatar">{initials}</span>
            <span className="hidden min-w-0 sm:block"><strong>{actor.displayName}</strong><small>{roleLabels[actor.role]}</small></span>
            <span aria-hidden="true" className="hidden text-xs text-muted-foreground sm:inline">⌄</span>
          </button>
          {menuOpen ? (
            <div aria-label="User menu" className="absolute right-0 top-14 w-48 rounded-xl border border-border bg-surface p-2 text-sm shadow-lg" id="user-menu" onKeyDown={handleMenuKeyDown} ref={menuRef} role="menu">
              <p className="px-2 py-1 text-xs text-muted-foreground" role="presentation">UTC+05:00 · Karachi</p>
              <a className="block rounded-lg px-2 py-2 font-medium text-foreground hover:bg-surface-subtle" href="/settings" role="menuitem" tabIndex={-1}>Account settings</a>
              <button className="block w-full rounded-lg px-2 py-2 text-left font-medium text-foreground hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-60" disabled={logoutPending} onClick={handleLogout} ref={signOutRef} role="menuitem" tabIndex={-1} type="button">{logoutPending ? "Signing out…" : "Sign out"}</button>
              {logoutError ? <p className="px-2 py-1 text-xs text-danger" role="alert">{logoutError}</p> : null}
            </div>
          ) : null}
        </div>

        <a aria-label="Notifications" className="command-notifications" href="/notifications">
          <svg aria-hidden="true" fill="none" viewBox="0 0 24 24"><path d="M7.5 9.5a4.5 4.5 0 0 1 9 0c0 5 2 5.5 2 6.5h-13c0-1 2-1.5 2-6.5ZM10 19h4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" /></svg>
          <span />
        </a>

        <form action="/search" className="command-search hidden md:flex" role="search">
          <label className="sr-only" htmlFor="global-search">Search Orbit</label>
          <span aria-hidden="true" className="command-search-icon"><svg fill="none" viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="5.5" stroke="currentColor" strokeWidth="1.8" /><path d="m15 15 4 4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" /></svg></span>
          <input id="global-search" name="q" placeholder="Search Orbit" />
          <kbd>⌘K</kbd>
        </form>
      </div>
    </header>
  );
}
