import type { ReactNode } from "react";
import Link from "next/link";

import type { LeadDetail, SessionUser } from "@orbit/contracts";

type LeadWorkspaceSection = "overview" | "interviews" | "communications" | "comments" | "offers" | "activity";

const sectionGlyphs: Record<LeadWorkspaceSection, string> = {
  overview: "◎",
  interviews: "◷",
  communications: "↗",
  comments: "••",
  offers: "◇",
  activity: "⌁",
};

const lifecycle = [
  { label: "Applied", statuses: ["APPLIED"] },
  { label: "Response", statuses: ["RESPONSE_RECEIVED"] },
  { label: "Interview", statuses: ["INTERVIEWING"] },
  { label: "Offer", statuses: ["OFFER_RECEIVED", "OFFER_ACCEPTED"] },
  { label: "Placed", statuses: ["PLACED"] },
  { label: "Started", statuses: ["STARTED"] },
] as const;

function candidateName(lead: LeadDetail): string {
  const candidate = lead.profile.candidate;
  return candidate.preferredName ?? `${candidate.firstName} ${candidate.lastName}`;
}

function updatedLabel(value: string): string {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(value));
}

export function LeadWorkspaceShell({
  activeSection,
  actorRole,
  children,
  headerAction,
  lead,
}: {
  activeSection: LeadWorkspaceSection;
  actorRole: SessionUser["role"];
  children: ReactNode;
  headerAction?: ReactNode;
  lead: LeadDetail;
}) {
  const currentStage = lifecycle.findIndex((stage) => stage.statuses.some((status) => status === lead.status));
  const sections: Array<{ href: string; id: LeadWorkspaceSection; label: string }> = [
    { href: `/leads/${lead.id}`, id: "overview", label: "Overview" },
    { href: `/leads/${lead.id}/interviews`, id: "interviews", label: "Interviews" },
    { href: `/leads/${lead.id}/communications`, id: "communications", label: "Communications" },
    { href: `/leads/${lead.id}/comments`, id: "comments", label: "Comments" },
    ...(actorRole === "CLOSER" ? [] : [{ href: `/leads/${lead.id}/offers`, id: "offers" as const, label: "Offers" }]),
    { href: `/leads/${lead.id}/activity`, id: "activity", label: "Activity" },
  ];

  return (
    <div className="mx-auto min-w-0 max-w-[1240px]">
      <Link className="inline-flex text-xs font-bold uppercase tracking-[0.16em] text-primary hover:underline" href="/leads">← Applications</Link>

      <header className="mt-4 min-w-0 border-b border-border pb-5">
        <div className="flex min-w-0 flex-col justify-between gap-4 lg:flex-row lg:items-start">
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Link className="truncate font-semibold text-foreground hover:text-primary" href={`/profiles/${lead.profile.id}`}>{candidateName(lead)}</Link>
              <span aria-hidden="true">/</span>
              <span className="truncate">{lead.profile.name}</span>
            </div>
            <h1 className="mt-2 break-words text-2xl font-bold tracking-[-0.035em] text-foreground sm:text-3xl">{lead.jobTitle}</h1>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{lead.company.canonicalName}</span>
              <span aria-hidden="true">·</span>
              <span>{lead.sourceRef.name}</span>
              <span aria-hidden="true">·</span>
              <span>Applied {lead.appliedDate}</span>
              <span aria-hidden="true">·</span>
              <span>Updated {updatedLabel(lead.updatedAt)}</span>
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <span className="rounded-full bg-primary-soft px-3 py-1.5 text-xs font-bold text-primary">{lead.status.replaceAll("_", " ")}</span>
            {headerAction}
          </div>
        </div>

        <section aria-label="Application progress" className="mt-5 min-w-0">
          <h2 className="sr-only">Application progress</h2>
          <ol className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
            {lifecycle.map((stage, index) => {
              const reached = currentStage >= 0 && index <= currentStage;
              const active = index === currentStage;
              return (
                <li className="min-w-0" key={stage.label}>
                  <span className={`block h-1.5 rounded-full ${reached ? "bg-primary" : "bg-border"}`} />
                  <span className={`mt-1.5 block truncate text-[0.68rem] font-semibold ${active ? "text-primary" : "text-muted-foreground"}`}>{stage.label}</span>
                </li>
              );
            })}
          </ol>
        </section>
      </header>

      <nav aria-label="Lead workspace" className="-mx-1 min-w-0 border-b border-border px-1">
        <div className="grid grid-cols-3 gap-1 py-2 sm:flex">
          {sections.map((section) => {
            const active = activeSection === section.id;
            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={`min-w-0 rounded-xl px-2 py-2 text-center text-[0.7rem] font-semibold transition sm:px-3 sm:text-sm ${active ? "bg-primary text-white" : "text-muted-foreground hover:bg-surface-subtle hover:text-foreground"}`}
                href={section.href}
                key={section.id}
              >
                <span aria-hidden="true" className="mr-1 text-[0.72rem]">{sectionGlyphs[section.id]}</span>{section.label}
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="min-w-0 pt-5">{children}</div>
    </div>
  );
}
