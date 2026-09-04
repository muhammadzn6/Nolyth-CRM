import type { Prisma } from "@prisma/client";

import { database } from "./client";

export function withTransaction<T>(
  work: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return database.$transaction(work);
}
