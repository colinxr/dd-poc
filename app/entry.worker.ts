/// <reference types="@cloudflare/workers-types" />

import "@shopify/shopify-api/adapters/cf-worker";
import prisma from "../app/db.server";

// Import the server build from the built file
import * as build from "../build/server/index.js";

interface Env {
  DB: any;
  SHOPIFY_API_KEY?: string;
  SHOPIFY_API_SECRET?: string;
  SHOPIFY_APP_URL?: string;
  SCOPES?: string;
  SHOP_CUSTOM_DOMAIN?: string;
  SESSION_SECRET?: string;
}

// Simple handler that works with the built server
export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    try {
      // For now, return a simple response to test the deployment
      return new Response(
        JSON.stringify({
          message: "Cloudflare Worker is working!",
          buildExists: !!build,
          buildKeys: Object.keys(build),
        }),
        {
          headers: { "Content-Type": "application/json" },
        },
      );
    } catch (error: any) {
      return new Response(`Error: ${error.message}`, { status: 500 });
    }
  },
} satisfies ExportedHandler<Env>;
