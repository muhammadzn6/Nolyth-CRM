import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { SessionUser } from "@orbit/contracts";
import { EmptyState, ErrorState, LoadingState, UnauthorizedState } from "@orbit/ui";

import { LoginForm } from "../auth/login-form";
import { DashboardOverview } from "../dashboard/dashboard-overview";
import { AppShell } from "./app-shell";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/",
}));

const actors: Record<SessionUser["role"], SessionUser> = {
  ADMIN: {
    id: "3a28ef58-ecbd-4bc8-970f-b641918ff368",
    displayName: "Maya Chen",
    email: "maya@orbit.example",
    role: "ADMIN",
    isActive: true,
  },
  BD: {
    id: "e986080b-dd4d-424c-b9d6-14b8576b7e83",
    displayName: "Avery Morgan",
    email: "avery@orbit.example",
    role: "BD",
    isActive: true,
  },
  CLOSER: {
    id: "f8149dac-ab11-46dd-84d5-c954f672c22f",
    displayName: "Nadia Reed",
    email: "nadia@orbit.example",
    role: "CLOSER",
    isActive: true,
  },
};

describe("AppShell", () => {
  it("shows the admin destination only to administrators", () => {
    const admin = renderToStaticMarkup(
      <AppShell actor={actors.ADMIN}>
        <p>Dashboard content</p>
      </AppShell>,
    );
    const bd = renderToStaticMarkup(
      <AppShell actor={actors.BD}>
        <p>Dashboard content</p>
      </AppShell>,
    );

    expect(admin).toContain('href="/admin/users"');
    expect(admin).toContain(">Users<");
    expect(admin).toContain('href="/candidates"');
    expect(admin).toContain(">Candidates<");
    expect(admin).toContain("Recruitment");
    expect(admin).toContain("Administration");
    expect(admin).not.toContain('href="/admin/clients"');
    expect(admin).not.toContain("Client calendars");
    expect(admin).toContain('href="/settings"');
    expect(bd).not.toContain('href="/admin"');
    expect(bd).not.toContain('href="/candidates"');
  });

  it("keeps BD navigation scoped and hides the profile list from Closers", () => {
    const bd = renderToStaticMarkup(
      <AppShell actor={actors.BD}>
        <p>BD dashboard</p>
      </AppShell>,
    );
    const closer = renderToStaticMarkup(
      <AppShell actor={actors.CLOSER}>
        <p>Closer dashboard</p>
      </AppShell>,
    );

    expect(bd).toContain('href="/profiles"');
    expect(bd).toContain('href="/activity"');
    expect(closer).not.toContain('href="/profiles"');
    expect(closer).toContain('href="/activity"');
    expect(closer).toContain('href="/settings"');
    expect(closer).not.toContain(">Analytics<");
  });

  it("renders the actor identity and a named primary navigation landmark", () => {
    const html = renderToStaticMarkup(
      <AppShell actor={actors.ADMIN}>
        <p>Dashboard content</p>
      </AppShell>,
    );

    expect(html).toContain("Maya Chen");
    expect(html).toContain("Administrator");
    expect(html).toContain('aria-label="Primary navigation"');
  });

  it("does not duplicate the creation action inside the sidebar", () => {
    const html = renderToStaticMarkup(
      <AppShell actor={actors.ADMIN}>
        <p>Dashboard content</p>
      </AppShell>,
    );

    expect(html).not.toContain('aria-label="Add candidate"');
    expect(html).toContain('aria-label="Quick add"');
  });
});

describe("foundation screens", () => {
  it("gives both login fields accessible labels", () => {
    const html = renderToStaticMarkup(<LoginForm />);

    expect(html).toContain('for="email"');
    expect(html).toContain("Work email");
    expect(html).toContain('id="email"');
    expect(html).toContain('type="email"');
    expect(html).toContain('for="password"');
    expect(html).toContain('id="password"');
    expect(html).toContain('type="password"');
  });

  it("provides an error message and retry action", () => {
    const html = renderToStaticMarkup(
      <ErrorState
        title="Dashboard unavailable"
        description="Orbit could not load this workspace."
        actionLabel="Try again"
        onAction={() => undefined}
      />,
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain("Dashboard unavailable");
    expect(html).toContain("Try again");
    expect(html).toContain("<button");
  });

  it("provides distinct loading, empty, and unauthorized states", () => {
    const loading = renderToStaticMarkup(<LoadingState label="Loading workspace" />);
    const empty = renderToStaticMarkup(
      <EmptyState title="No activity yet" description="New events will appear here." />,
    );
    const unauthorized = renderToStaticMarkup(
      <UnauthorizedState description="You do not have access to this workspace." />,
    );

    expect(loading).toContain('aria-live="polite"');
    expect(loading).toContain("Loading workspace");
    expect(empty).toContain("No activity yet");
    expect(unauthorized).toContain("Access restricted");
  });

  it("renders the dashboard calendar and a recent activity feed", () => {
    const html = renderToStaticMarkup(<DashboardOverview actor={actors.ADMIN} />);

    expect(html).toContain('aria-label="Admin dashboard context"');
    expect(html).toContain("Agenda");
    expect(html).toContain("Open calendar display settings");
    expect(html).toContain("Recent activity");
    expect(html).toContain("Lead moved to interviewing");
    expect(html).toContain("Workspace pulse");
    expect(html).not.toContain("Scheduling &amp; workload");
    expect(html).not.toContain("Employer operations");
  });
});
