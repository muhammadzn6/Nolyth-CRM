import mongoose from "mongoose";

import { getRequiredEnv } from "@/lib/env";

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
  uri: string | null;
};

declare global {
  var __mongooseCache__: MongooseCache | undefined;
}

const globalCache = globalThis.__mongooseCache__ ?? {
  conn: null,
  promise: null,
  uri: null,
};

globalThis.__mongooseCache__ = globalCache;

export async function connectToDatabase(): Promise<typeof mongoose> {
  const uri = getRequiredEnv("MONGODB_URI");

  if (globalCache.conn && globalCache.uri === uri) {
    return globalCache.conn;
  }

  if (!globalCache.promise || globalCache.uri !== uri) {
    globalCache.uri = uri;
    globalCache.promise = mongoose.connect(uri, {
      bufferCommands: false,
      maxPoolSize: 10,
    });
  }

  globalCache.conn = await globalCache.promise;
  return globalCache.conn;
}

export async function disconnectFromDatabase() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  globalCache.conn = null;
  globalCache.promise = null;
  globalCache.uri = null;
}
