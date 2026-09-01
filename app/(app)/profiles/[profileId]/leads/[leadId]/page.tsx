import { Suspense } from "react";

import { LeadDetailView } from "@/components/leads/lead-detail/lead-detail-view";
import { requireActiveUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ profileId: string; leadId: string }>;
}) {
  const actor = await requireActiveUser();
  const { profileId, leadId } = await params;
  const canEdit = actor.role === "ADMIN" || actor.role === "BD" || actor.role === "CLOSER";

  return (
    <Suspense fallback={<div className="text-sm text-[var(--color-text-muted)]">Loading lead…</div>}>
      <LeadDetailView profileId={profileId} leadId={leadId} canEdit={canEdit} />
    </Suspense>
  );
}
