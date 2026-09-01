import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

import { connectToDatabase, disconnectFromDatabase } from "@/lib/db/mongoose";

export function setupTestDatabase() {
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = new URL(mongoServer.getUri("orbit_test"));
    uri.searchParams.set("retryWrites", "false");

    process.env.MONGODB_URI = uri.toString();
    process.env.AUTH_SECRET = "test-secret";
    process.env.AUTH_URL = "http://localhost:3000";

    await connectToDatabase();
  });

  afterEach(async () => {
    await Promise.all(
      Object.values(mongoose.connection.collections).map((collection) =>
        collection.deleteMany({}),
      ),
    );
  });

  afterAll(async () => {
    await disconnectFromDatabase();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });
}
