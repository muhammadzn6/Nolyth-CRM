import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = fileURLToPath(new URL("..", import.meta.url));

try {
  for (const line of readFileSync(resolve(workspaceRoot, ".env"), "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    const value = match[2].trim();
    process.env[match[1]] = value.startsWith('"') && value.endsWith('"')
      ? value.slice(1, -1)
      : value.startsWith("'") && value.endsWith("'")
        ? value.slice(1, -1)
        : value;
  }
} catch {
  // Let Next/API environment validation report missing configuration.
}

const nextPath = resolve(workspaceRoot, "apps/web/node_modules/.bin/next");
const result = spawnSync(nextPath, ["build", ...process.argv.slice(2)], {
  cwd: resolve(workspaceRoot, "apps/web"),
  env: process.env,
  stdio: "inherit",
});

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
