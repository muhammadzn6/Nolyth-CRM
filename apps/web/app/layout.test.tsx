import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import RootLayout from "./layout";

describe("RootLayout", () => {
  it("declares smooth scrolling for Next route navigation", () => {
    const html = renderToStaticMarkup(<RootLayout><main>Orbit</main></RootLayout>);

    expect(html).toContain('data-scroll-behavior="smooth"');
  });
});
