import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/table";
import { requireActiveUser } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/utils/format";
import { listAccessibleProfiles } from "@/services/profile-service";

export const dynamic = "force-dynamic";

export default async function AdminProfilesPage() {
  const actor = await requireActiveUser();
  const profiles = await listAccessibleProfiles(actor);

  return (
    <div className="space-y-6">
      <PageHeader title="Admin profiles" />

      <Card>
        <CardBody className="p-0">
          {profiles.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title="No profiles yet"
                description="Create profiles through the admin API or seed the database to validate the Phase 1 foundation."
              />
            </div>
          ) : (
            <Table>
              <TableHead>
                <tr>
                  <TableHeaderCell>Profile</TableHeaderCell>
                  <TableHeaderCell>Status</TableHeaderCell>
                  <TableHeaderCell>Created</TableHeaderCell>
                </tr>
              </TableHead>
              <TableBody>
                {profiles.map((profile) => (
                  <TableRow key={profile._id.toString()}>
                    <TableCell className="font-medium">{profile.name}</TableCell>
                    <TableCell>
                      <Badge variant={profile.isActive ? "success" : "neutral"}>
                        {profile.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-[var(--color-text-muted)]">
                      {formatDateTime(profile.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
