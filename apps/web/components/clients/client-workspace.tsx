"use client";

import type { CompanySummary } from "@orbit/contracts";
import { Card } from "@orbit/ui";

export function ClientWorkspace({ company }: { company: CompanySummary }) {
  const tabs = [
    { label: "Overview", href: "#overview" },
    { label: "Pipeline", href: `/leads?companyId=${company.id}` },
    { label: "Offers", href: `/admin/clients/${company.id}/offers` },
    { label: "Placements", href: `/admin/clients/${company.id}/placements` },
    { label: "Analytics", href: `/analytics?companyId=${company.id}` },
    { label: "Workspace activity", href: `/activity?companyId=${company.id}` },
  ];

  return (
    <div className="grid gap-5">
      <nav className="flex flex-wrap gap-2" aria-label="Employer workspace tabs">
        {tabs.map((tab) => <a className="rounded-full border border-border bg-surface px-4 py-2 text-sm font-semibold text-muted-foreground hover:border-primary hover:text-primary" href={tab.href} key={tab.label}>{tab.label}</a>)}
      </nav>
      <div className="grid gap-5" id="overview">
        <Card className="p-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Employer overview</p>
          <h2 className="mt-2 text-2xl font-bold text-foreground">{company.canonicalName}</h2>
          <p className="mt-2 text-sm text-muted-foreground">Employer details attached to job applications. Candidate calendars and closer assignments are managed from each profile and application.</p>
          <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
            <div><p className="text-muted-foreground">Industry</p><p className="mt-1 font-semibold text-foreground">{company.industry ?? "Not set"}</p></div>
            <div><p className="text-muted-foreground">Location</p><p className="mt-1 font-semibold text-foreground">{company.location ?? "Not set"}</p></div>
            <div><p className="text-muted-foreground">Website</p><p className="mt-1 truncate font-semibold text-foreground">{company.website ?? "Not set"}</p></div>
            <div><p className="text-muted-foreground">Workspace</p><p className="mt-1 font-semibold text-foreground">Active employer workspace</p></div>
          </div>
        </Card>
      </div>
    </div>
  );
}
