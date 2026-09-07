"use client";

import { useState } from "react";
import type { ProfileSummary, SessionUser } from "@orbit/contracts";
import { Button } from "@orbit/ui";

import { BulkImportForm } from "../data/bulk-import-form";
import { Dialog } from "../ui/dialog";
import { LeadCaptureForm } from "./lead-capture-form";

export function LeadPageActions({ actor, defaultOpen = false, profiles }: { actor: SessionUser; defaultOpen?: boolean; profiles: ProfileSummary[] }) {
  const [intakeOpen, setIntakeOpen] = useState(defaultOpen);
  const [importOpen, setImportOpen] = useState(false);

  return <>
    <div className="flex flex-wrap gap-2">
      {actor.role === "BD" ? <Button aria-label="Add application" onClick={() => setIntakeOpen(true)}>Add application</Button> : null}
      {actor.role !== "CLOSER" ? <Button aria-label="Import applications" onClick={() => setImportOpen(true)} variant="secondary">Import CSV</Button> : null}
    </div>
    <Dialog description="Record the job and recruiter details; the applied date is captured automatically." onOpenChange={setIntakeOpen} open={intakeOpen} title="Add application">
      <LeadCaptureForm actorId={actor.id} profiles={profiles} embedded />
    </Dialog>
    <Dialog description="Upload applications in bulk and review invalid rows before continuing." onOpenChange={setImportOpen} open={importOpen} title="Import applications">
      <BulkImportForm kind="lead" surface={false} />
    </Dialog>
  </>;
}
