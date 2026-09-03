import { PrismaClient } from "@prisma/client";

const globalForDatabase = globalThis as unknown as { database?: PrismaClient };

export const database = globalForDatabase.database ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForDatabase.database = database;
}
