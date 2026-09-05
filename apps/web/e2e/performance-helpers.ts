import { expect, type Page, type TestInfo } from "@playwright/test";

function origin(value: string, label: string): URL {
  try {
    return new URL(value);
  } catch {
    throw new Error(`${label} must be an absolute URL.`);
  }
}

export function requiredE2eCredential(name: "ORBIT_E2E_ADMIN_PASSWORD" | "ORBIT_E2E_BD_PASSWORD"): string {
  const value = process.env[name];
  expect(value, `${name} must be set from your local environment before running browser checks.`).toBeTruthy();
  return value!;
}

export function assertPerformancePorts(baseURL: string | undefined) {
  const web = origin(baseURL ?? "http://localhost:3100", "Playwright base URL");
  const api = origin(process.env.ORBIT_E2E_API_ORIGIN ?? "http://localhost:3101", "ORBIT_E2E_API_ORIGIN");
  expect(web.hostname).toBe("localhost");
  expect(web.port).toBe("3100");
  expect(api.hostname).toBe("localhost");
  expect(api.port).toBe("3101");
  expect([web.port, api.port]).not.toContain("3000");
  expect([web.port, api.port]).not.toContain("3001");
}

export async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in to Orbit" }).click();
  await expect(page).toHaveURL("/");
}

export function auditBrowser(page: Page) {
  const consoleErrors: string[] = [];
  const failedResponses: string[] = [];
  const appOrigins = new Set([
    origin(page.url() === "about:blank" ? "http://localhost:3100" : page.url(), "Browser page").origin,
    origin(process.env.ORBIT_E2E_API_ORIGIN ?? "http://localhost:3101", "ORBIT_E2E_API_ORIGIN").origin,
  ]);

  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (text.includes("cz-shortcut-listen")) return;
    consoleErrors.push(text);
  });
  page.on("response", (response) => {
    const origin = new URL(response.url()).origin;
    if (!appOrigins.has(origin) || response.status() < 400) return;
    failedResponses.push(`${response.status()} ${response.request().method()} ${response.url()}`);
  });

  return {
    allowResponse(fragment: string) {
      const index = failedResponses.findIndex((entry) => entry.includes(fragment));
      if (index >= 0) failedResponses.splice(index, 1);
    },
    allowConsole(fragment: string) {
      for (let index = consoleErrors.length - 1; index >= 0; index -= 1) {
        if (consoleErrors[index]?.includes(fragment)) consoleErrors.splice(index, 1);
      }
    },
    expectClean() {
      expect(consoleErrors, `app-owned console errors:\n${consoleErrors.join("\n")}`).toEqual([]);
      expect(failedResponses, `unexpected app HTTP failures:\n${failedResponses.join("\n")}`).toEqual([]);
    },
  };
}

export async function saveBrowserScreenshot(page: Page, testInfo: TestInfo, label: string) {
  const safeName = `${testInfo.titlePath.join("-")}-${label}`.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
  await page.screenshot({ fullPage: true, path: testInfo.outputPath(`${safeName}.png`) });
}
