import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { JobLinkActions } from "./job-link-actions";

describe("JobLinkActions", () => {
  it("shows a compact normalized host instead of exposing the layout-breaking raw URL", () => {
    const rawUrl = "https://www.linkedin.com/jobs/view/1234567890/?utm_source=orbit&trackingId=very-long-value#details";
    const html = renderToStaticMarkup(<JobLinkActions canonicalUrl="https://www.linkedin.com/jobs/view/1234567890" rawUrl={rawUrl} />);

    expect(html).toContain("linkedin.com");
    expect(html).not.toContain("utm_source");
    expect(html).toContain('aria-label="Open job description"');
    expect(html).toContain('aria-label="Copy job description link"');
  });
});
