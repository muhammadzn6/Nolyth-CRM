"use client";

import { useState } from "react";
import type { ProfileSummary } from "@orbit/contracts";

import { LeadCaptureForm } from "../leads/lead-capture-form";
import { Dialog } from "../ui/dialog";

export function BdApplicationEntry({ actorId, profiles }: { actorId: string; profiles: ProfileSummary[] }) {
  const [open, setOpen] = useState(false);

  return <>
    <button aria-label="Add application" className="editorial-add-button" onClick={() => setOpen(true)} type="button">+ Add application <span aria-hidden="true">›</span></button>
    <Dialog description="Record the job and recruiter details; the applied date is captured automatically." onOpenChange={setOpen} open={open} title="Add application"><div aria-label="Add application modal"><LeadCaptureForm actorId={actorId} profiles={profiles} embedded /></div></Dialog>
  </>;
}
