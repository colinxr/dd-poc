/// <reference types="@cloudflare/workers-types" />

import { createRequestHandler } from "@react-router/cloudflare";
import { prismaStorage, createPrismaClient } from "./db.server";
import { initShopify } from "./shopify.server";

interface Env {
  DB: D1Database;
  SHOPIFY_API_KEY: string;
  SHOPIFY_API_SECRET: string;
  SHOPIFY_APP_URL?: string;
  SCOPES?: string;
  SHOP_CUSTOM_DOMAIN?: string;
  SESSION_SECRET?: string;
  NODE_ENV?: string;
}

const handleRequest = createRequestHandler({
  build: () =>
    import("virtual:react-router/server-build").then((m: any) => m.build || m),
  mode: "production",
  getLoadContext({ context }: any) {
    return {
      cloudflare: {
        env: context.env as Env,
        ctx: context.ctx,
      },
    };
  },
});

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    // Initialize Shopify with Cloudflare env vars
    initShopify({
      SHOPIFY_API_KEY: env.SHOPIFY_API_KEY,
      SHOPIFY_API_SECRET: env.SHOPIFY_API_SECRET,
      SHOPIFY_APP_URL: env.SHOPIFY_APP_URL,
      SCOPES: env.SCOPES,
      SHOP_CUSTOM_DOMAIN: env.SHOP_CUSTOM_DOMAIN,
    });

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
