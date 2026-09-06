const disposableDatabaseNames = new Set(["orbit_task3_test", "orbit_e2e"]);

export function assertDemoSeedDatabaseAllowed(input: {
  databaseUrl: string | undefined;
  nodeEnv: string | undefined;
  allowDemoSeed?: boolean;
}) {
  let databaseName: string | undefined;

  try {
    databaseName = input.databaseUrl ? new URL(input.databaseUrl).pathname.replace(/^\/+/, "") : undefined;
  } catch {
    databaseName = undefined;
  }

  if (input.nodeEnv !== "production" && (disposableDatabaseNames.has(databaseName ?? "") || input.allowDemoSeed)) return;

  throw new Error(
    "Demo seed may only target a disposable database (orbit_task3_test or orbit_e2e). Set ORBIT_ALLOW_DEMO_SEED=true only for a deliberate non-production override.",
  );
}
