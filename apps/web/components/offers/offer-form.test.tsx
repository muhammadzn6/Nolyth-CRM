// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { OfferSummary } from "@orbit/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OfferForm } from "./offer-form";

const { createLeadOfferMock } = vi.hoisted(() => ({
  createLeadOfferMock: vi.fn(),
}));

vi.mock("../../lib/api-client", () => ({
  createLeadOffer: createLeadOfferMock,
  updateOffer: vi.fn(),
}));

function change(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const prototype =
    element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("OfferForm", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    createLeadOfferMock.mockReset();
    createLeadOfferMock.mockRejectedValue(new Error("Stop after capture"));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("submits a decision deadline in the acting user's timezone", async () => {
    await act(async () =>
      root.render(
        <OfferForm
          leadId="60000000-0000-4000-8000-000000000001"
          timezone="America/New_York"
        />,
      ),
    );

    await act(async () => {
      change(container.querySelector('[placeholder="Compensation"]') as HTMLInputElement, "150000");
      change(container.querySelector('[placeholder="Offer details"]') as HTMLTextAreaElement, "Base and equity");
      change(container.querySelector('input[type="datetime-local"]') as HTMLInputElement, "2026-09-08T10:00");
    });
    await act(async () =>
      container.querySelector("form")?.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      ),
    );

    expect(createLeadOfferMock).toHaveBeenCalledWith(
      "60000000-0000-4000-8000-000000000001",
      expect.objectContaining({ decisionDeadline: "2026-09-08T14:00:00.000Z" }),
    );
  });

  it("renders a stored deadline in the acting user's timezone", async () => {
    const offer = {
      id: "70000000-0000-4000-8000-000000000001",
      leadId: "60000000-0000-4000-8000-000000000001",
      compensationAmount: "150000",
      compensationCurrency: "USD",
      employmentType: "Full-time",
      details: "Base and equity",
      decisionDeadline: "2026-09-08T14:00:00.000Z",
      status: "OFFERED",
      startDate: null,
      startedAt: null,
      createdById: "00000000-0000-4000-8000-000000000001",
      acceptedAt: null,
      version: 1,
      createdAt: "2026-09-01T08:00:00.000Z",
      updatedAt: "2026-09-01T08:00:00.000Z",
    } as OfferSummary;
    await act(async () => root.render(<OfferForm leadId={offer.leadId} offer={offer} timezone="America/New_York" />));

    expect((container.querySelector('input[type="datetime-local"]') as HTMLInputElement).value).toBe("2026-09-08T10:00");
  });
});
