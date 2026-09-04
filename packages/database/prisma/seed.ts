import { argon2id, hash } from "argon2";

import { database } from "../src/client";

async function main() {
  const seedPassword = process.env.ORBIT_SEED_ADMIN_PASSWORD;

  if (!seedPassword) {
    throw new Error("ORBIT_SEED_ADMIN_PASSWORD is required to seed admin credentials");
  }

  const passwordChangedAt = new Date();
  const passwordHash = await hash(seedPassword, { type: argon2id });

  await database.user.upsert({
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
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await database.$disconnect();
  });
