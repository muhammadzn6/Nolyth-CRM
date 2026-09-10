"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ProfileSummary, SessionUser } from "@orbit/contracts";
import { Button } from "@orbit/ui";

import { BulkImportForm } from "../data/bulk-import-form";
import { Dialog } from "../ui/dialog";
import { LeadCaptureForm } from "./lead-capture-form";

export function LeadPageActions({ actor, defaultOpen = false, profiles }: { actor: SessionUser; defaultOpen?: boolean; profiles: ProfileSummary[] }) {
  const router = useRouter();
  const [intakeOpen, setIntakeOpen] = useState(defaultOpen);
  const [importOpen, setImportOpen] = useState(false);
  const [notice, setNotice] = useState<string>();

  return <>
    <div className="flex flex-wrap gap-2">
      {actor.role === "BD" ? <Button aria-label="Add application" onClick={() => { setNotice(undefined); setIntakeOpen(true); }}>Add application</Button> : null}
      {actor.role !== "CLOSER" ? <Button aria-label="Import applications" onClick={() => setImportOpen(true)} variant="secondary">Import CSV</Button> : null}
      {notice ? <p className="self-center text-sm font-semibold text-success" role="status">{notice}</p> : null}
    </div>
    <Dialog description="Record the job and recruiter details; the applied date is captured automatically." onOpenChange={setIntakeOpen} open={intakeOpen} title="Add application">
      <LeadCaptureForm actorId={actor.id} profiles={profiles} embedded onSuccess={() => { setIntakeOpen(false); setNotice("Application added."); router.refresh(); }} />
    </Dialog>
    <Dialog description="Upload applications in bulk and review invalid rows before continuing." onOpenChange={setImportOpen} open={importOpen} title="Import applications">
      <BulkImportForm kind="lead" surface={false} />
    </Dialog>
  </>;
}
