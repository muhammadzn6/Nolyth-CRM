const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "fbclid",
  "mc_eid",
  "ref",
]);

export function normalizeJobUrl(url: string): string {
  const trimmed = url.trim();

  try {
    const parsed = new URL(trimmed);
    const pathname =
      parsed.pathname.length > 1 ? parsed.pathname.replace(/\/+$/, "") : parsed.pathname;

    const searchParams = new URLSearchParams(parsed.search);
    for (const key of [...searchParams.keys()]) {
      if (TRACKING_PARAMS.has(key.toLowerCase())) {
        searchParams.delete(key);
      }
    }

    const search = searchParams.toString();
    return `${parsed.protocol}//${parsed.host.toLowerCase()}${pathname}${search ? `?${search}` : ""}`;
  } catch {
    return trimmed.toLowerCase();
  }
}

export function isSafeWebUrl(url: string): boolean {
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function formatJobUrlDisplay(url: string, maxLength = 42): string {
  try {
    const parsed = new URL(url.trim());
    const host = parsed.hostname.replace(/^www\./, "");
    const path = parsed.pathname === "/" ? "" : parsed.pathname;
    const display = `${host}${path}`;

    if (display.length <= maxLength) {
      return display;
    }

    return `${display.slice(0, maxLength - 1)}…`;
  } catch {
    if (url.length <= maxLength) {
      return url;
    }

    return `${url.slice(0, maxLength - 1)}…`;
  }
}

export function formatJobUrlCompact(url: string, maxLength = 16): string {
  const trimmed = url.trim();
  if (!trimmed) {
    return "";
  }

  try {
    const host = new URL(trimmed).hostname.replace(/^www\./, "");
    if (host.length <= maxLength) {
      return host;
    }

    return `${host.slice(0, maxLength - 1)}…`;
  } catch {
    if (trimmed.length <= maxLength) {
      return trimmed;
    }

    return `${trimmed.slice(0, maxLength - 1)}…`;
  }
}
