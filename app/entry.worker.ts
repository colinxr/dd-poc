import "@shopify/shopify-api/adapters/cf-worker";
import { createRequestHandler } from "@react-router/cloudflare";
import type { AppLoadContext } from "react-router";
import prisma from "../app/db.server";

declare module "react-router" {
  export interface AppLoadContext {
    cloudflare: {
      env: Env;
      ctx: ExecutionContext;
    };
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const response = await createRequestHandler({
      build: await import("virtual:react-router/server-build"),
      mode: process.env.NODE_ENV,
      getLoadContext(): AppLoadContext {
        return { cloudflare: { env, ctx } };
      },
    })(request, { DB: prisma });
    return response;
  },
} satisfies ExportedHandler<Env>;
