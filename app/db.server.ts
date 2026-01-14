import { PrismaClient } from "@prisma/client";
import { PrismaD1 } from "@prisma/adapter-d1";

declare global {
  var prismaGlobal: PrismaClient | undefined;
}

function createPrismaClient(env: { DB?: D1Database } | undefined = undefined) {
  if (env?.DB) {
    const adapter = new PrismaD1(env.DB);
    return new PrismaClient({ adapter });
  }
  return new PrismaClient();
}

const prisma = global.prismaGlobal ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  global.prismaGlobal = prisma;
}

export default prisma;

export type PrismaEnvironment = { DB: D1Database } | undefined;
