import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const workspaceRoot = fileURLToPath(new URL("..", import.meta.url));
const processes = [
  {
    name: "web",
    command: `${workspaceRoot}/apps/web/node_modules/.bin/next`,
    args: ["dev", "-p", process.env.PORT ?? "3100"],
    cwd: `${workspaceRoot}/apps/web`,
  },
  {
    name: "api",
    command: `${workspaceRoot}/apps/api/node_modules/.bin/tsx`,
    args: ["src/main.ts"],
    cwd: `${workspaceRoot}/apps/api`,
  },
  {
    name: "worker",
    command: `${workspaceRoot}/apps/worker/node_modules/.bin/tsx`,
    args: ["src/main.ts"],
    cwd: `${workspaceRoot}/apps/worker`,
  },
];

let stopping = false;
const children = processes.map((entry) => {
  const child = spawn(entry.command, entry.args, {
    cwd: entry.cwd,
    env: process.env,
    stdio: "inherit",
  });

  child.once("exit", (code, signal) => {
    if (stopping) return;

    process.stderr.write(
      `${entry.name} exited before smoke completion (${signal ?? code ?? "unknown"})\n`,
    );
    process.exitCode = code && code > 0 ? code : 1;
    stop("SIGTERM");
  });

  return child;
});

function stop(signal) {
  if (stopping) return;
  stopping = true;

  for (const child of children) {
    if (child.exitCode === null && child.signalCode === null) child.kill(signal);
  }
}

process.once("SIGINT", () => stop("SIGINT"));
process.once("SIGTERM", () => stop("SIGTERM"));
