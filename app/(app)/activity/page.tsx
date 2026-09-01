import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireActiveUser } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/utils/format";
import { listVisibleActivity } from "@/services/activity-service";

export const dynamic = "force-dynamic";

export default async function ActivityPage() {
  const actor = await requireActiveUser();
  const activity = await listVisibleActivity(actor);

  return (
    <div className="space-y-6">
      <PageHeader title="Activity" />

      <Card>
        <CardBody className="space-y-4">
          {activity.length === 0 ? (
            <EmptyState
              title="No activity yet"
              description="Seed data or service mutations will populate the centralized audit feed."
            />
          ) : (
            activity.map((event) => (
              <div
                key={event._id.toString()}
                className="flex flex-col gap-3 rounded-xl bg-surface-secondary px-4 py-3 lg:flex-row lg:items-center lg:justify-between"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-[var(--color-text)]">
                      {event.action}
                    </p>
                    <Badge variant="neutral">{event.entityType}</Badge>
                  </div>
                  <p className="text-sm text-[var(--color-text-muted)]">
                    {event.actorNameSnapshot} • {event.actorRoleSnapshot}
                  </p>
                </div>
                <p className="text-sm text-[var(--color-text-muted)]">
                  {formatDateTime(event.createdAt)}
                </p>
              </div>
            ))
          )}
        </CardBody>
      </Card>
    </div>
  );
}
