"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { usePathname, useRouter } from "next/navigation";

import type { SessionUser } from "@orbit/contracts";
import { Button } from "@orbit/ui";
import { logout } from "../../lib/api-client";

const roleLabels = { ADMIN: "Administrator", BD: "Business development", CLOSER: "Closer" } as const;
const quickActions = {
  ADMIN: [
    ["Add candidate", "/candidates?new=candidate"],
    ["Add profile", "/candidates"],
    ["Invite user", "/admin/users?new=user"],
    ["Add interview", "/leads"],
  ],
  BD: [
    ["Add application", "/leads?new=application"],
    ["Log recruiter response", "/leads"],
    ["Log communication", "/leads"],
  ],
  CLOSER: [
    ["Add interview outcome", "/leads"],
    ["Add feedback", "/leads"],
    ["Add task", "/tasks"],
  ],
} as const;

export function AppHeader({ actor, onNavigationToggle = () => undefined }: { actor: SessionUser; onNavigationToggle?: () => void }) {
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
    <header className="sticky top-0 z-30 mx-3 mt-3 flex min-h-16 items-center gap-2 rounded-[1.5rem] border border-white/80 bg-[linear-gradient(110deg,rgba(255,255,255,0.97),rgba(255,250,247,0.95))] px-2.5 shadow-[0_14px_40px_rgba(35,42,58,0.07)] backdrop-blur-xl md:mx-5 md:gap-3 md:px-4 lg:mx-7" data-testid="command-header">
      <button aria-label="Toggle navigation" className="grid size-10 shrink-0 place-items-center rounded-full text-foreground transition hover:bg-surface-subtle focus-visible:ring-2 focus-visible:ring-focus lg:hidden" onClick={onNavigationToggle} type="button"><span aria-hidden="true" className="text-lg leading-none">☰</span></button>
      <span aria-hidden="true" className="hidden size-10 place-items-center rounded-full bg-foreground text-xs font-black text-white shadow-[0_6px_16px_rgba(17,24,39,0.16)] sm:grid">O</span>
      <div className="hidden min-w-0 sm:block"><p className="text-sm font-bold leading-tight text-foreground">Orbit</p><p className="truncate text-[10px] text-muted-foreground">{actor.role === "ADMIN" ? "Admin command center" : actor.role === "BD" ? "Placement operations" : "Interview workspace"}</p></div>
      <div className="min-w-0 border-l border-border pl-2 sm:pl-3" data-testid="command-page-identity">
        <span className="block truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{roleLabels[actor.role]}</span>
        <span className="block truncate text-sm font-bold capitalize text-foreground">{pageLabel}</span>
      </div>
      <div className="relative ml-1 hidden sm:block">
        <button aria-expanded={quickOpen} aria-haspopup="menu" aria-label="Quick add" className="grid size-10 place-items-center rounded-full bg-action text-xl font-medium leading-none text-white shadow-[0_9px_20px_rgba(235,101,72,0.24)] transition hover:-translate-y-0.5 hover:bg-action-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus motion-reduce:transform-none" onClick={() => setQuickOpen((value) => !value)} title="Quick add" type="button"><span aria-hidden="true">＋</span></button>
        {quickOpen ? <div aria-label="Quick add menu" className="absolute left-0 top-11 w-56 rounded-2xl border border-border bg-surface p-2 shadow-[0_18px_48px_rgba(17,24,39,0.16)]" role="menu">{quickActions[actor.role].map(([label, href]) => <a className="flex min-h-10 items-center rounded-xl px-3 text-sm font-semibold text-foreground hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus" href={href} key={label} onClick={() => setQuickOpen(false)} role="menuitem">{label}</a>)}</div> : null}
      </div>
      <form action="/search" className="relative ml-auto hidden w-full max-w-[340px] md:block" role="search">
        <label className="sr-only" htmlFor="global-search">Search Orbit</label>
        <span aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">⌕</span>
        <input className="h-10 w-full rounded-full border border-border/80 bg-white/65 pl-9 pr-12 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary focus:bg-white focus:ring-3 focus:ring-focus/15" id="global-search" name="q" placeholder="Search profiles, leads, people…" />
        <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md border border-border bg-surface-subtle px-1.5 py-0.5 text-[10px] text-muted-foreground">⌘K</kbd>
      </form>
      <a aria-label="Notifications" className="relative grid size-9 place-items-center rounded-xl text-foreground transition hover:bg-surface-subtle focus-visible:ring-2 focus-visible:ring-focus" href="/notifications">
        <span aria-hidden="true">♢</span><span className="absolute right-2 top-2 size-2 rounded-full border-2 border-background bg-danger" />
      </a>
      <div className="relative">
        <button aria-controls="user-menu" aria-expanded={menuOpen} aria-haspopup="menu" aria-label="Account menu" className="flex items-center gap-2.5 rounded-xl p-1.5 text-left outline-none transition hover:bg-surface-subtle focus-visible:ring-2 focus-visible:ring-focus" onClick={() => menuOpen ? closeMenu(false) : openMenu("first")} onKeyDown={handleMenuTriggerKeyDown} ref={menuTriggerRef} type="button">
          <span className="grid size-8 place-items-center rounded-lg bg-primary-soft text-xs font-bold text-primary">{initials}</span>
          <span className="hidden min-w-0 sm:block"><span className="block max-w-36 truncate text-xs font-semibold text-foreground">{actor.displayName}</span><span className="block text-[11px] text-muted-foreground">{roleLabels[actor.role]}</span></span>
          <span aria-hidden="true" className="hidden text-xs text-muted-foreground sm:inline">⌄</span>
        </button>
        {menuOpen ? (
          <div aria-label="User menu" className="absolute right-0 top-12 w-48 rounded-xl border border-border bg-surface p-2 text-sm shadow-lg" id="user-menu" onKeyDown={handleMenuKeyDown} ref={menuRef} role="menu">
            <p className="px-2 py-1 text-xs text-muted-foreground" role="presentation">UTC+05:00 · Karachi</p>
            <a className="block rounded-lg px-2 py-2 font-medium text-foreground hover:bg-surface-subtle" href="/settings" role="menuitem" tabIndex={-1}>Account settings</a>
            <button className="block w-full rounded-lg px-2 py-2 text-left font-medium text-foreground hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-60" disabled={logoutPending} onClick={handleLogout} ref={signOutRef} role="menuitem" tabIndex={-1} type="button">{logoutPending ? "Signing out…" : "Sign out"}</button>
            {logoutError ? <p className="px-2 py-1 text-xs text-danger" role="alert">{logoutError}</p> : null}
          </div>
        ) : null}
      </div>
    </header>
  );
}
