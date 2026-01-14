/// <reference types="@cloudflare/workers-types" />

// Polyfill process for Shopify library compatibility
if (typeof process === "undefined") {
  globalThis.process = { env: {} } as any;
}

import { createPagesFunctionHandler } from "@react-router/cloudflare";

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

export default createPagesFunctionHandler({
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
