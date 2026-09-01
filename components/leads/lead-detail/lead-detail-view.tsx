"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ExternalLink, Star } from "lucide-react";

import { LeadActivitySection } from "@/components/leads/lead-detail/lead-activity-section";
import { LeadJobSection } from "@/components/leads/lead-detail/lead-job-section";
import { LeadRoundsSection } from "@/components/leads/lead-detail/lead-rounds-section";
import { LeadStatusControl } from "@/components/leads/lead-status-control";
import { STATUS_LABELS } from "@/components/leads/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchLeadDetail, patchLead } from "@/lib/leads/client-api";
import { formatDateTime, formatRate } from "@/lib/utils/format";
import { formatJobUrlDisplay, isSafeWebUrl } from "@/lib/utils/url";
import type { LeadDetail } from "@/types/lead-detail";

export function LeadDetailView({
  profileId,
  leadId,
  canEdit,
}: {
  profileId: string;
  leadId: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const returnHref = `/profiles/${profileId}${searchParams.get("return") ? `?${searchParams.get("return")}` : ""}`;

  const loadLead = useCallback(async () => {
    setIsLoading(true);
    try {
      const detail = await fetchLeadDetail(leadId);
      setLead(detail);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load lead");
    } finally {
      setIsLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      void loadLead();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [loadLead]);

  const handlePatch = async (patch: Record<string, unknown>) => {
    if (!lead) {
      return;
    }

    setLead({ ...lead, ...patch } as LeadDetail);
    try {
      const updated = await patchLead(leadId, patch);
      setLead({ ...lead, ...updated });
    } catch (patchError) {
      setError(patchError instanceof Error ? patchError.message : "Couldn't save changes");
      void loadLead();
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!lead || error) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => router.push(returnHref)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to workspace
        </Button>
        <p className="text-sm text-[var(--color-danger)]">{error ?? "Lead not found"}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Link
          href={returnHref}
          className="inline-flex items-center gap-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to workspace
        </Link>
      </div>

      <section className="space-y-3 pb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="orbit-heading text-foreground">
                {lead.companyName}
              </h1>
              <button
                type="button"
                aria-label={lead.isImportant ? "Remove important" : "Mark important"}
                disabled={!canEdit}
                onClick={() => void handlePatch({ isImportant: !lead.isImportant })}
                className={lead.isImportant ? "text-accent" : "text-[var(--color-text-muted)]"}
              >
                <Star className={lead.isImportant ? "h-5 w-5 fill-current" : "h-5 w-5"} />
              </button>
            </div>
            <p className="text-base text-[var(--color-text-muted)]">
              {lead.jobTitle || "No job title"}
            </p>
          </div>

          {canEdit ? (
            <LeadStatusControl
              status={lead.status}
              deadReason={lead.deadReason}
              deadNotes={lead.deadNotes}
              onChange={(patch) => void handlePatch(patch)}
            />
          ) : (
            <Badge variant="neutral">{STATUS_LABELS[lead.status]}</Badge>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--color-text-muted)]">
          <span>Applied {formatDateTime(lead.appliedDate)}</span>
          <span>{formatRate(lead.rateAmount, lead.rateUnit)}</span>
          {lead.contractType ? <span>{lead.contractType}</span> : null}
          {lead.jobType ? <span>{lead.jobType}</span> : null}
          {isSafeWebUrl(lead.jobUrl) ? (
            <a
              href={lead.jobUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1 text-[var(--color-accent)] hover:underline"
            >
              {formatJobUrlDisplay(lead.jobUrl)}
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : null}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <LeadJobSection lead={lead} canEdit={canEdit} onPatch={handlePatch} />
          <LeadRoundsSection
            leadId={leadId}
            canEdit={canEdit}
            onRoundsChanged={loadLead}
          />
        </div>
        <LeadActivitySection leadId={leadId} />
      </div>
    </div>
  );
}
