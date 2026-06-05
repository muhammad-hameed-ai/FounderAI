import { MongoClient, ServerApiVersion } from "mongodb";
import { logger } from "./logger";

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error("MONGODB_URI environment variable is required");
}

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: false,
    deprecationErrors: true,
  },
  tls: true,
  tlsAllowInvalidCertificates: false,
  tlsAllowInvalidHostnames: false,
  connectTimeoutMS: 15000,
  socketTimeoutMS: 45000,
  serverSelectionTimeoutMS: 15000,
  retryWrites: true,
  retryReads: true,
});

let connected = false;
let connectPromise: Promise<void> | null = null;

export async function getDb() {
  if (!connected) {
    if (!connectPromise) {
      connectPromise = client
        .connect()
        .then(() => {
          connected = true;
          logger.info("Connected to MongoDB Atlas");
        })
        .catch((err) => {
          connectPromise = null;
          connected = false;
          logger.error({ err: { message: (err as Error).message, name: (err as Error).name } }, "MongoDB connection failed");
          throw err;
        });
    }
    await connectPromise;
  }
  return client.db("founderai");
}

export async function getSessionsCollection() {
  const db = await getDb();
  return db.collection("sessions");
}

export async function getMemoriesCollection() {
  const db = await getDb();
  return db.collection("memories");
}

export { client };
