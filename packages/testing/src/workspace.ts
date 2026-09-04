import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const workspaceRoot = resolve(import.meta.dirname, "../../..");

const workspacePackages = [
  "apps/web",
  "apps/api",
  "apps/worker",
  "packages/config",
  "packages/contracts",
  "packages/database",
  "packages/backend",
  "packages/ui",
  "packages/testing",
];

type PackageMetadata = {
  name: string;
  exports: Record<string, string>;
};

export function readWorkspacePackageMetadata(): PackageMetadata[] {
  return workspacePackages.map((workspacePackage) => {
    const packageJsonPath = resolve(workspaceRoot, workspacePackage, "package.json");
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as PackageMetadata;

    return packageJson;
  });
}

export function readWorkspacePackageNames(): string[] {
  return readWorkspacePackageMetadata().map(({ name }) => name);
}

export function hasWorkspaceFile(relativePath: string): boolean {
  try {
    readFileSync(resolve(workspaceRoot, relativePath));
    return true;
  } catch {
    return false;
  }
}
