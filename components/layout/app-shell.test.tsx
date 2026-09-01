// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";

import { AppShell } from "@/components/layout/app-shell";

describe("AppShell", () => {
  it("shows admin navigation only to admins", () => {
    render(
      <AppShell
        user={{
          id: "1",
          name: "Admin User",
          email: "admin@example.com",
          role: "ADMIN",
          isActive: true,
        }}
      >
        <div>Admin content</div>
      </AppShell>,
    );

    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Users")).toBeInTheDocument();
    expect(screen.getByText("Profiles")).toBeInTheDocument();
    expect(screen.getByText("Admin Profiles")).toBeInTheDocument();
  });

  it("hides admin-only navigation from non-admin users", () => {
    render(
      <AppShell
        user={{
          id: "2",
          name: "BD User",
          email: "bd@example.com",
          role: "BD",
          isActive: true,
        }}
      >
        <div>BD content</div>
      </AppShell>,
    );

    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.queryByText("Users")).not.toBeInTheDocument();
    expect(screen.getAllByText("Profiles").length).toBeGreaterThan(0);
  });
});
