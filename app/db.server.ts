import { PrismaClient } from "@prisma/client";
import { PrismaD1 } from "@prisma/adapter-d1";
import { AsyncLocalStorage } from "node:async_hooks";

declare global {
  var prismaGlobal: PrismaClient | undefined;
}

export type PrismaEnvironment =
  | {
      DB?: D1Database;
      prisma?: PrismaClient;
    }
  | undefined;

// Create AsyncLocalStorage to store the Prisma client for the current request
export const prismaStorage = new AsyncLocalStorage<PrismaClient>();

function createPrismaClient(env?: PrismaEnvironment): PrismaClient {
  if (env?.DB) {
    const adapter = new PrismaD1(env.DB);
    return new PrismaClient({ adapter });
  }

  if (isCloudflareWorker()) {
    throw new Error(
      "CreatePrismaClient called in Cloudflare Worker without D1 binding (env.DB). Check wrangler.toml and worker entry.",
    );
  }

  return new PrismaClient();
}

function isCloudflareWorker(): boolean {
  return typeof process !== "undefined" && process.env.TARGET === "worker";
}

// Helper to get the correct Prisma client
function getPrismaClient(): PrismaClient {
  if (isCloudflareWorker()) {
    const store = prismaStorage.getStore();
    if (store) {
      return store;
    }
    // Fallback for non-request contexts in Cloudflare (e.g., initialization)
    // This assumes we might not always have a request context when merely importing/initializing
    console.warn(
      "Prisma Client accessed in Cloudflare Worker without request context.",
    );
    // We cannot throw here because some libraries might access the client on import or outside of a request.
    // However, actual database queries *will* fail if they try to use this client without a proper adapter.
    // But since we are creating a new client here without D1, it will try to use local SQLite or fail.
    // Ideally, we should throw, but if the app architecture requires access outside, we might need a dummy.
    // Let's stick to the previous strict check but double check why it thinks it is a worker.

    // REVERTING TO STRICT CHECK because sloppy access is bad.
    // The issue is likely that `isCloudflareWorker` is returning true locally because of some env var leakage or misconfiguration.
    throw new Error(
      "Prisma Client accessed in Cloudflare Worker without request context. Ensure code is running within prismaStorage.run().",
    );
  }

  // Local development / Node.js
  if (!global.prismaGlobal) {
    global.prismaGlobal = createPrismaClient();
  }
  return global.prismaGlobal;
}

// Proxy to delegate to the request-scoped client
const prisma = new Proxy({} as PrismaClient, {
  get(target, prop) {
    const client = getPrismaClient();
    // @ts-ignore
    const value = client[prop];
    if (typeof value === "function") {
      // @ts-ignore
      return value.bind(client);
    }
    return value;
  },
});

export { createPrismaClient };
export default prisma;
