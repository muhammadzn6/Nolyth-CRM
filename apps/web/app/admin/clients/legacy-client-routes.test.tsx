import { beforeEach, describe, expect, it, vi } from "vitest";

const redirectMock = vi.hoisted(() => vi.fn());
const api = vi.hoisted(() => ({
  getCurrentActor: vi.fn(),
  listCompanies: vi.fn(),
  listLeadOffers: vi.fn(),
  listLeads: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers({ cookie: "orbit_session=token" })) }));
vi.mock("next/navigation", () => ({ notFound: vi.fn(), redirect: redirectMock }));
vi.mock("../../../lib/api-client", () => ({
  ApiClientError: class ApiClientError extends Error {},
  getCurrentActor: api.getCurrentActor,
  listCompanies: api.listCompanies,
  listLeadOffers: api.listLeadOffers,
  listLeads: api.listLeads,
}));

import ClientRoute from "./[clientId]/page";
import EditClientRoute from "./[clientId]/edit/page";
import ClientOffersRoute from "./[clientId]/offers/page";
import ClientPlacementsRoute from "./[clientId]/placements/page";
import NewClientRoute from "./new/page";
import ClientsRoute from "./page";

describe("legacy client routes", () => {
  beforeEach(() => {
    redirectMock.mockReset();
    api.getCurrentActor.mockResolvedValue({ id: "10000000-0000-4000-8000-000000000001", role: "ADMIN", displayName: "Orbit Admin", email: "admin@orbit.test", isActive: true });
    api.listCompanies.mockResolvedValue([{ id: "40000000-0000-4000-8000-000000000001", canonicalName: "Northstar Labs", domain: null, industry: null }]);
    api.listLeads.mockResolvedValue({ items: [], nextCursor: null });
    api.listLeadOffers.mockResolvedValue([]);
  });

  it.each([
    ["directory", () => ClientsRoute()],
    ["new employer", () => NewClientRoute()],
    ["workspace", () => ClientRoute()],
    ["edit employer", () => EditClientRoute()],
    ["offers", () => ClientOffersRoute()],
    ["placements", () => ClientPlacementsRoute()],
  ])("redirects the obsolete %s surface to applications", async (_label, renderRoute) => {
    await renderRoute();

    expect(redirectMock).toHaveBeenCalledWith("/leads");
  });
});
