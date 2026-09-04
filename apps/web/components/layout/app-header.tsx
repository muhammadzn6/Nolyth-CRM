"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { usePathname, useRouter } from "next/navigation";

import type { SessionUser } from "@orbit/contracts";
import { Button } from "@orbit/ui";
import { logout } from "../../lib/api-client";

const roleLabels = { ADMIN: "Administrator", BD: "Business development", CLOSER: "Closer" } as const;

export function AppHeader({ actor }: { actor: SessionUser }) {
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
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
  const pageLabel = pathname === "/" ? "Dashboard" : pathname.startsWith("/admin/clients/") ? "Employer workspace" : pathname === "/admin/clients" ? "Employer directory" : pathname === "/admin/client-calendars" ? "Calendar integrations" : pathname === "/admin/users" ? "Users" : pathname === "/calendar" ? "Interview calendar" : pathname.slice(1).split("/")[0]?.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) || "Workspace";

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
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border/70 bg-background/90 px-4 backdrop-blur md:px-6 lg:px-10">
      <div className="w-10 shrink-0 lg:hidden" />
      <div className="hidden items-center gap-2 text-sm text-muted-foreground sm:flex">
        <span>Workspace</span><span aria-hidden="true">/</span><span className="font-semibold capitalize text-foreground">{pageLabel}</span>
      </div>
      <form action="/search" className="relative ml-auto hidden w-full max-w-[340px] md:block" role="search">
        <label className="sr-only" htmlFor="global-search">Search Orbit</label>
        <span aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">⌕</span>
        <input className="h-9 w-full rounded-xl border border-border bg-surface pl-9 pr-12 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-3 focus:ring-focus/15" id="global-search" name="q" placeholder="Search profiles, leads, people…" />
        <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md border border-border bg-surface-subtle px-1.5 py-0.5 text-[10px] text-muted-foreground">⌘K</kbd>
      </form>
      <a aria-label="Notifications" className="relative grid size-9 place-items-center rounded-xl text-foreground transition hover:bg-surface-subtle focus-visible:ring-2 focus-visible:ring-focus" href="/notifications">
        <span aria-hidden="true">♢</span><span className="absolute right-2 top-2 size-2 rounded-full border-2 border-background bg-danger" />
      </a>
      <div className="relative">
        <button aria-controls="user-menu" aria-expanded={menuOpen} aria-haspopup="menu" className="flex items-center gap-2.5 rounded-xl p-1.5 text-left outline-none transition hover:bg-surface-subtle focus-visible:ring-2 focus-visible:ring-focus" onClick={() => menuOpen ? closeMenu(false) : openMenu("first")} onKeyDown={handleMenuTriggerKeyDown} ref={menuTriggerRef} type="button">
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
