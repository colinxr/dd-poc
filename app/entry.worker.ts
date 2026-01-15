/// <reference types="@cloudflare/workers-types" />

// Polyfill process for Shopify library compatibility
if (typeof process === "undefined") {
  globalThis.process = { env: {} } as any;
}

import { createRequestHandler } from "@react-router/cloudflare";
import { prismaStorage, createPrismaClient } from "./db.server";

interface Env {
  DB: D1Database;
  SHOPIFY_API_KEY?: string;
  SHOPIFY_API_SECRET?: string;
  SHOPIFY_APP_URL?: string;
  SCOPES?: string;
  SHOP_CUSTOM_DOMAIN?: string;
  SESSION_SECRET?: string;
  NODE_ENV?: string;
}

const handleRequest = createRequestHandler({
  build: () =>
    import("virtual:react-router/server-build").then((m: any) => m.build || m),
  mode: process.env.NODE_ENV || "production",
  getLoadContext({ context }: any) {
    return {
      cloudflare: {
        env: context.env as Env,
        ctx: context.ctx,
      },
    };
  },
});

// Populate process.env with Cloudflare env vars for Shopify SDK compatibility
function populateProcessEnv(env: Env) {
  process.env.SHOPIFY_API_KEY = env.SHOPIFY_API_KEY;
  process.env.SHOPIFY_API_SECRET = env.SHOPIFY_API_SECRET;
  process.env.SHOPIFY_APP_URL = env.SHOPIFY_APP_URL;
  process.env.SCOPES = env.SCOPES;
  process.env.SHOP_CUSTOM_DOMAIN = env.SHOP_CUSTOM_DOMAIN;
  process.env.SESSION_SECRET = env.SESSION_SECRET;
  process.env.NODE_ENV = env.NODE_ENV;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    // Populate process.env before any modules that depend on it are used
    populateProcessEnv(env);

    const prisma = createPrismaClient({ DB: env.DB });

    return prismaStorage.run(prisma, () => {
      return handleRequest({
        request,
        env,
        waitUntil: ctx.waitUntil.bind(ctx),
        passThroughOnException: ctx.passThroughOnException.bind(ctx),
        params: {},
        data: {},
        next: () => Promise.resolve(new Response(null, { status: 404 })),
        functionPath: "",
      } as any);
    });
  },
};
