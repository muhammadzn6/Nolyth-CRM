import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../lib/api-client", () => ({
  decideOffer: vi.fn(),
  placeOffer: vi.fn(),
  startPlacement: vi.fn(),
}));

import { OfferActions } from "./offer-actions";

describe("OfferActions", () => {
  it("does not offer to start a placement that already started", () => {
    const html = renderToStaticMarkup(
      <OfferActions
        id="offer-1"
        startDate="2026-09-10"
        startedAt="2026-09-10T13:00:00.000Z"
        status="ACCEPTED"
        version={4}
      />,
    );

    expect(html).not.toContain("Mark started");
  });
});
