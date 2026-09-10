import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import type { ProfileStatus } from "@orbit/contracts";
import { Button, Card, EmptyState, ErrorState, Field, Input } from "@orbit/ui";

import { AppShell } from "../../components/layout/app-shell";
import { ApiClientError, getCurrentActor, listProfiles } from "../../lib/api-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Profiles" };

const statusOptions = ["ACTIVE", "DRAFT", "PAUSED", "ARCHIVED"] as const satisfies readonly ProfileStatus[];

const statusClasses: Record<ProfileStatus, string> = {
  ACTIVE: "bg-success-soft text-success",
  DRAFT: "bg-info-soft text-info",
  PAUSED: "bg-warning-soft text-warning-foreground",
  ARCHIVED: "bg-surface-subtle text-muted-foreground",
};

type ProfilesSearchParams = {
  search?: string | string[];
  status?: string | string[];
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseStatus(value: string | undefined): ProfileStatus | undefined {
  return statusOptions.find((status) => status === value);
}

function sentenceCase(value: string) {
  const normalized = value.replaceAll("_", " ").toLowerCase();
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function formatList(values: string[], fallback: string) {
  return values.length > 0 ? values.join(" · ") : fallback;
}

function formatPreferences(values: string[], fallback: string) {
  return values.length > 0 ? values.map(sentenceCase).join(" · ") : fallback;
}

export default async function ProfilesRoute({
  searchParams,
}: {
  searchParams?: Promise<ProfilesSearchParams>;
}) {
  const cookie = (await headers()).get("cookie") ?? undefined;
  const actor = await getCurrentActor(cookie);
  if (!actor) redirect("/login");

  const rawFilters = (await searchParams) ?? {};
  const search = firstValue(rawFilters.search)?.trim() || undefined;
  const status = parseStatus(firstValue(rawFilters.status));
  const hasFilters = Boolean(search || status);

  let page;
  try {
    page = await listProfiles(
      {
        ...(search ? { search } : {}),
        ...(status ? { status } : {}),
        limit: 100,
      },
      cookie,
    );
  } catch (reason) {
    return (
      <AppShell actor={actor}>
        <ErrorState
          description={reason instanceof ApiClientError ? reason.message : "Orbit could not load profiles."}
          title="Profiles unavailable"
        />
      </AppShell>
    );
  }

  const counts = statusOptions.reduce<Record<ProfileStatus, number>>(
    (summary, profileStatus) => ({
      ...summary,
      [profileStatus]: page.items.filter((profile) => profile.status === profileStatus).length,
    }),
    { ACTIVE: 0, DRAFT: 0, PAUSED: 0, ARCHIVED: 0 },
  );

  return (
    <AppShell actor={actor}>
      <div className="mx-auto grid max-w-[1500px] gap-5">
        <header>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Job searches</p>
          <h1 className="mt-2 text-2xl font-bold tracking-[-0.03em] text-foreground sm:text-3xl">Profiles</h1>
        </header>

        <Card className="p-4 sm:p-5">
          <form action="/profiles" aria-label="Filter profiles" className="grid gap-3 md:grid-cols-[minmax(0,1fr)_13rem_auto] md:items-end" key={`${search ?? ""}:${status ?? ""}`} method="get">
            <Field htmlFor="profile-search" label="Search profiles">
              <Input defaultValue={search} id="profile-search" name="search" placeholder="Profile name, role, or location" type="search" />
            </Field>
            <Field htmlFor="profile-status" label="Status">
              <select
                className="h-11 w-full rounded-xl border border-border bg-surface px-3.5 text-sm text-foreground outline-none transition hover:border-border-strong focus:border-primary focus:ring-3 focus:ring-focus/15"
                defaultValue={status ?? ""}
                id="profile-status"
                name="status"
              >
                <option value="">All statuses</option>
                {statusOptions.map((profileStatus) => (
                  <option key={profileStatus} value={profileStatus}>{sentenceCase(profileStatus)}</option>
                ))}
              </select>
            </Field>
            <div className="flex gap-2">
              <Button className="flex-1 md:flex-none" type="submit" variant="secondary">Apply</Button>
              {hasFilters ? (
                <Link className="inline-flex h-10 items-center justify-center rounded-xl px-3 text-sm font-semibold text-muted-foreground hover:bg-surface-subtle hover:text-foreground" href="/profiles">
                  Clear
                </Link>
              ) : null}
            </div>
          </form>
        </Card>

        <div aria-label="Profile summary" className="flex flex-wrap items-center gap-x-5 gap-y-2 border-y border-border/70 py-3 text-sm">
          <span className="rounded-full bg-surface-subtle px-2.5 py-1 font-semibold text-foreground" title="Profiles in this view">{page.items.length}<span className="sr-only"> shown</span></span>
          <span className="inline-flex items-center gap-1.5 text-muted-foreground" title="Active profiles"><span aria-hidden="true" className="size-1.5 rounded-full bg-success" /><span className="font-semibold text-success">{counts.ACTIVE}</span>{" "}<span>active</span></span>
          <span className="inline-flex items-center gap-1.5 text-muted-foreground" title="Draft profiles"><span aria-hidden="true" className="size-1.5 rounded-full bg-info" /><span className="font-semibold text-info">{counts.DRAFT}</span>{" "}<span>draft</span></span>
          <span className="inline-flex items-center gap-1.5 text-muted-foreground" title="Paused profiles"><span aria-hidden="true" className="size-1.5 rounded-full bg-warning" /><span className="font-semibold text-warning-foreground">{counts.PAUSED}</span>{" "}<span>paused</span></span>
          <span className="inline-flex items-center gap-1.5 text-muted-foreground" title="Archived profiles"><span aria-hidden="true" className="size-1.5 rounded-full bg-muted-foreground" /><span className="font-semibold text-foreground">{counts.ARCHIVED}</span>{" "}<span>archived</span></span>
        </div>

        {page.items.length === 0 && hasFilters ? (
          <Card className="grid min-h-56 place-items-center border-dashed p-6 text-center">
            <div>
              <span aria-hidden="true" className="mx-auto grid size-10 place-items-center rounded-xl bg-info-soft text-info">⌕</span>
              <h2 className="mt-4 text-base font-semibold text-foreground">No profiles match these filters</h2>
              <p className="mt-1.5 text-sm leading-6 text-muted-foreground">Try another search or status to widen the result set.</p>
              <Link className="mt-5 inline-flex h-10 items-center justify-center rounded-xl bg-action px-5 text-sm font-semibold text-action-foreground shadow-[0_8px_20px_rgba(235,101,72,0.2)] hover:bg-action-hover" href="/profiles">
                Clear filters
              </Link>
            </div>
          </Card>
        ) : null}

        {page.items.length === 0 && !hasFilters ? (
          actor.role === "ADMIN" ? (
            <EmptyState description="Create a candidate first, then add a profile from the candidate record." title="No profiles yet" />
          ) : (
            <EmptyState description="Profiles will appear here when they are added to your assigned workload." title="No assigned profiles" />
          )
        ) : null}

        {page.items.length > 0 ? (
          <Card aria-label="Profile records" className="overflow-hidden p-0">
            <div className="hidden border-b border-border/80 bg-surface-subtle px-5 py-3.5 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground md:grid md:grid-cols-[minmax(220px,1.35fr)_minmax(190px,1fr)_minmax(230px,1.15fr)_auto_4rem] md:gap-5">
              <span>Profile</span>
              <span>Target roles</span>
              <span>Locations &amp; work style</span>
              <span>Status</span>
              <span />
            </div>
            <div className="data-scroll-region max-h-[calc(100vh-23rem)] min-h-[22rem] divide-y divide-border/70 overflow-y-auto">
              {page.items.map((profile) => (
                <article className="group grid gap-4 px-5 py-4 transition-colors hover:bg-surface-subtle md:grid-cols-[minmax(220px,1.35fr)_minmax(190px,1fr)_minmax(230px,1.15fr)_auto_4rem] md:items-center md:gap-5" key={profile.id}>
                  <div className="min-w-0">
                    <Link className="font-semibold text-foreground outline-none group-hover:text-primary focus-visible:text-primary" href={`/profiles/${profile.id}`}>
                      {profile.name}
                    </Link>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground" title={profile.description ?? "No profile summary added"}>{profile.description ?? "No profile summary added"}</p>
                  </div>
                  <div className="min-w-0">
                    <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground md:hidden">Target roles</span>
                    <p className="flex items-start gap-1.5 text-sm leading-5 text-foreground" title={formatList(profile.targetRoles, "Roles not set")}><span aria-hidden="true" className="mt-0.5 text-primary">⌁</span>{formatList(profile.targetRoles, "Roles not set")}</p>
                  </div>
                  <div className="min-w-0">
                    <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground md:hidden">Locations &amp; work style</span>
                    <p className="flex items-start gap-1.5 text-sm leading-5 text-foreground" title={formatList(profile.preferredLocations, "Locations not set")}><span aria-hidden="true" className="mt-0.5 text-primary">⌖</span>{formatList(profile.preferredLocations, "Locations not set")}</p>
                    <p className="mt-1 text-xs text-muted-foreground" title={formatPreferences(profile.workplacePreferences, "Work style not set")}>{formatPreferences(profile.workplacePreferences, "Work style not set")}</p>
                  </div>
                  <div>
                    <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground md:hidden">Status</span>
                    <span title={sentenceCase(profile.status)} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${statusClasses[profile.status]}`}>
                      <span aria-hidden="true">{profile.status === "ACTIVE" ? "✓" : profile.status === "PAUSED" ? "Ⅱ" : profile.status === "DRAFT" ? "·" : "—"}</span>
                      {sentenceCase(profile.status)}
                    </span>
                  </div>
                  <Link aria-label={`Open ${profile.name}`} className="font-semibold text-primary hover:underline md:text-right" href={`/profiles/${profile.id}`}>
                    Open<span aria-hidden="true"> →</span>
                  </Link>
                </article>
              ))}
            </div>
          </Card>
        ) : null}
      </div>
    </AppShell>
  );
}
