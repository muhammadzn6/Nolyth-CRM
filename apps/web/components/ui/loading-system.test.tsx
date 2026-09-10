import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Button, LoadingState } from "@orbit/ui";

describe("Orbit loading system", () => {
  it("makes a pending action visibly busy and unavailable", () => {
    const html = renderToStaticMarkup(
      <Button loading type="submit">
        Add application
      </Button>,
    );

    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("disabled");
    expect(html).toContain('data-orbit-spinner="true"');
    expect(html).not.toContain('loading=""');
  });

  it("announces loading surfaces and renders branded progress", () => {
    const html = renderToStaticMarkup(
      <LoadingState label="Loading candidate workspace" />,
    );

    expect(html).toContain('role="status"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("Loading candidate workspace");
    expect(html).toContain('data-orbit-spinner="true"');
    expect(html).toContain('data-orbit-page-loader="true"');
    expect(html).not.toContain("animate-pulse");
  });
});
