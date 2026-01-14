import { PrismaClient } from "@prisma/client";
import { PrismaD1 } from "@prisma/adapter-d1";

declare global {
  var prismaGlobal: PrismaClient | undefined;
}

export type PrismaEnvironment =
  | {
      DB?: D1Database;
      prisma?: PrismaClient;
    }
  | undefined;

function createPrismaClient(env?: PrismaEnvironment): PrismaClient {
  if (env?.DB) {
    const adapter = new PrismaD1(env.DB);
    return new PrismaClient({ adapter });
  }
  return new PrismaClient();
}

function isCloudflareWorker(): boolean {
  return typeof process !== "undefined" && process.env.TARGET === "worker";
}

const prisma =
  global.prismaGlobal ??
  createPrismaClient(isCloudflareWorker() ? undefined : undefined);

if (process.env.NODE_ENV !== "production") {
  global.prismaGlobal = prisma;
}

export { createPrismaClient };
export default prisma;
