import mongoose, { type ClientSession } from "mongoose";

const UNSUPPORTED_TRANSACTION_MESSAGES = [
  "Transaction numbers are only allowed on a replica set member or mongos",
  "replica set",
  "does not support retryable writes",
];

function isUnsupportedTransactionError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return UNSUPPORTED_TRANSACTION_MESSAGES.some((message) =>
    error.message.includes(message),
  );
}

export async function runInTransaction<T>(
  work: (session: ClientSession | null) => Promise<T>,
): Promise<T> {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();
    const result = await work(session);
    await session.commitTransaction();
    return result;
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }

    if (isUnsupportedTransactionError(error)) {
      return work(null);
    }

    throw error;
  } finally {
    await session.endSession();
  }
}
