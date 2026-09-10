"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ContactSummary, OfferSummary, UserSummary } from "@orbit/contracts";
import { Button } from "@orbit/ui";

import { InterviewForm } from "../interviews/interview-form";
import { OfferForm } from "../offers/offer-form";
import { Dialog } from "../ui/dialog";
import { CollaborationForm } from "./collaboration-form";

function useMutationDialog() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  return {
    open,
    setOpen,
    complete() {
      setOpen(false);
      router.refresh();
    },
  };
}

export function InterviewCreateAction({ closers, leadId, onOpen, timezone }: { closers: UserSummary[]; leadId: string; onOpen?: () => void; timezone: string }) {
  const dialog = useMutationDialog();
  return <><Button disabled={!closers.length} onClick={() => { onOpen?.(); dialog.setOpen(true); }}>Schedule interview</Button><Dialog description="Choose the responsible Closer and record the interview in the candidate’s timezone." onOpenChange={dialog.setOpen} open={dialog.open} title="Schedule interview"><InterviewForm closers={closers} embedded leadId={leadId} onSuccess={dialog.complete} timezone={timezone} /></Dialog></>;
}

export function CollaborationCreateAction({ contacts, initialVisibility, kind, label: customLabel, leadId, onOpen, recruiterResponse = false, sharedOnly = false, timezone }: { contacts?: ContactSummary[]; initialVisibility?: "INTERNAL_TEAM" | "SHARED_WITH_CLOSER"; kind: "comments" | "communications"; label?: string; leadId: string; onOpen?: () => void; recruiterResponse?: boolean; sharedOnly?: boolean; timezone?: string }) {
  const dialog = useMutationDialog();
  const label = customLabel ?? (kind === "comments" ? "Add comment" : recruiterResponse ? "Log recruiter response" : "Add communication");
  const description = kind === "communications" ? recruiterResponse ? "Record the inbound reply that activates this application." : "Record a recruiter conversation or internal communication." : sharedOnly ? "Share a note with the application team." : "Keep an internal or Closer-shared note attached to this application.";
  return <><Button onClick={() => { onOpen?.(); dialog.setOpen(true); }}>{label}</Button><Dialog description={description} onOpenChange={dialog.setOpen} open={dialog.open} title={label}><CollaborationForm contacts={contacts} embedded initialDirection={recruiterResponse ? "INBOUND" : undefined} initialVisibility={initialVisibility} kind={kind} leadId={leadId} onSuccess={dialog.complete} sharedOnly={sharedOnly} timezone={timezone} /></Dialog></>;
}

export function OfferDialogAction({ leadId, offer, timezone }: { leadId: string; offer?: OfferSummary; timezone: string }) {
  const dialog = useMutationDialog();
  const label = offer ? "Edit offer" : "Create offer";
  return <><Button onClick={() => dialog.setOpen(true)} variant={offer ? "secondary" : "primary"}>{label}</Button><Dialog description={offer ? "Update the recorded compensation and decision details." : "Record the offer attached to this application."} onOpenChange={dialog.setOpen} open={dialog.open} title={label}><OfferForm embedded leadId={leadId} offer={offer} onSuccess={dialog.complete} timezone={timezone} /></Dialog></>;
}
