import { argon2id, hash } from "argon2";

async function main() {
  const seedPassword = process.env.ORBIT_SEED_ADMIN_PASSWORD;

  if (!seedPassword) {
    throw new Error("ORBIT_SEED_ADMIN_PASSWORD is required to seed admin credentials");
  }

  const { database } = await import("../src/client");
  const passwordChangedAt = new Date();
  const passwordHash = await hash(seedPassword, { type: argon2id });

  try {
    const admin = await database.user.upsert({
      where: { email: "admin@orbit.local" },
      create: {
        displayName: "Orbit Administrator",
        email: "admin@orbit.local",
        passwordChangedAt,
        passwordHash,
        role: "ADMIN",
        timezone: "UTC",
      },
      update: {
        displayName: "Orbit Administrator",
        isActive: true,
        passwordChangedAt,
        passwordHash,
        role: "ADMIN",
        timezone: "UTC",
      },
    });

    const activeRule = await database.performanceRuleSet.findFirst({
      where: { effectiveFrom: { lte: new Date() }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }] },
    });
    if (!activeRule) {
      await database.performanceRuleSet.create({
        data: {
          effectiveFrom: new Date("2020-01-01T00:00:00.000Z"),
          createdById: admin.id,
        },
      });
    }
  } finally {
    await database.$disconnect();
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
