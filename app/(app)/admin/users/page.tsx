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
import { formatDateTime, formatRole } from "@/lib/utils/format";
import { listUsers } from "@/services/user-service";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const actor = await requireActiveUser();
  const users = await listUsers(actor);

  return (
    <div className="space-y-6">
      <PageHeader title="Users" />

      <Card>
        <CardBody className="p-0">
          {users.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title="No users found"
                description="Run the seed script to create demo accounts for Phase 1."
              />
            </div>
          ) : (
            <Table>
              <TableHead>
                <tr>
                  <TableHeaderCell>Name</TableHeaderCell>
                  <TableHeaderCell>Role</TableHeaderCell>
                  <TableHeaderCell>Status</TableHeaderCell>
                  <TableHeaderCell>Created</TableHeaderCell>
                </tr>
              </TableHead>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user._id.toString()}>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="font-medium text-[var(--color-text)]">{user.name}</p>
                        <p className="text-xs text-[var(--color-text-muted)]">{user.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="accent">{formatRole(user.role)}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.isActive ? "success" : "neutral"}>
                        {user.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-[var(--color-text-muted)]">
                      {formatDateTime(user.createdAt)}
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
