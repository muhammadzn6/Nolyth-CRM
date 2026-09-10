"use client";

import { useState } from "react";
import type { ContactSummary, UserSummary } from "@orbit/contracts";
import { Button } from "@orbit/ui";

import { CollaborationCreateAction, InterviewCreateAction } from "./lead-workspace-actions";

export function LeadActionCenter({ actorRole, closers, contacts, leadId, timezone }: { actorRole: "ADMIN" | "BD" | "CLOSER"; closers: UserSummary[]; contacts: ContactSummary[]; leadId: string; timezone: string }) {
  const [open, setOpen] = useState(false);
  const [menuMounted, setMenuMounted] = useState(false);
  if (actorRole === "CLOSER") return null;
  const closeMenu = () => setOpen(false);
  const toggleMenu = () => { setMenuMounted(true); setOpen((value) => !value); };
  return <div className="relative"><Button aria-expanded={open} aria-haspopup="menu" aria-label="Application actions" onClick={toggleMenu} variant="secondary">Actions</Button>{menuMounted ? <div aria-hidden={!open} aria-label={open ? "Application actions" : undefined} className={`${open ? "" : "hidden"} absolute right-0 top-12 z-20 grid min-w-56 gap-1 rounded-2xl border border-border bg-surface p-2 shadow-lg`} role={open ? "menu" : undefined}><div role="menuitem"><CollaborationCreateAction contacts={contacts} kind="communications" label="Log communication" leadId={leadId} onOpen={closeMenu} timezone={timezone} /></div><div role="menuitem"><CollaborationCreateAction contacts={contacts} kind="communications" label="Log recruiter response" leadId={leadId} onOpen={closeMenu} recruiterResponse timezone={timezone} /></div><div role="menuitem"><CollaborationCreateAction kind="comments" label="Add comment" leadId={leadId} onOpen={closeMenu} /></div><div role="menuitem"><InterviewCreateAction closers={closers} leadId={leadId} onOpen={closeMenu} timezone={timezone} /></div></div> : null}</div>;
}
