import Link from "next/link";

import { DashboardContent } from "@/components/dashboard/dashboard-content";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { requireActiveUser } from "@/lib/auth/session";
import { getDashboardData } from "@/services/dashboard-service";

export const dynamic = "force-dynamic";

export default async function ApplicationHomePage() {
  const actor = await requireActiveUser();
  const dashboard = await getDashboardData(actor);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${actor.name.split(/\s+/)[0]}`}
        actions={
          <Link href="/profiles">
            <Button variant="secondary">Open profiles</Button>
          </Link>
        }
      />
      <DashboardContent data={dashboard} />
    </div>
  );
}
