import "@shopify/shopify-api/adapters/web-api";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
  type ShopifyApp,
} from "@shopify/shopify-app-react-router/server";
import { WorkerSessionStorage } from "./worker-session-storage";
import prisma from "./db.server";

export const apiVersion = ApiVersion.October25;

export interface ShopifyEnv {
  SHOPIFY_API_KEY: string;
  SHOPIFY_API_SECRET: string;
  SHOPIFY_APP_URL?: string;
  SCOPES?: string;
  SHOP_CUSTOM_DOMAIN?: string;
}

// Store shopify instance in globalThis - keyed by API key to handle multiple envs
declare global {
  var __shopifyAppInstance: ShopifyApp | undefined;
  var __shopifyEnv: ShopifyEnv | undefined;
}

// Must be called once at the start of each request with the Cloudflare env
export function initShopify(env: ShopifyEnv): void {
  // Only reinitialize if env changed (or first time)
  if (!globalThis.__shopifyAppInstance || globalThis.__shopifyEnv?.SHOPIFY_API_KEY !== env.SHOPIFY_API_KEY) {
    globalThis.__shopifyEnv = env;
    globalThis.__shopifyAppInstance = shopifyApp({
      apiKey: env.SHOPIFY_API_KEY,
      apiSecretKey: env.SHOPIFY_API_SECRET,
      apiVersion: ApiVersion.October25,
      scopes: env.SCOPES?.split(","),
      appUrl: env.SHOPIFY_APP_URL || "https://rr-dd-poc.colinxr.workers.dev",
      authPathPrefix: "/auth",
      sessionStorage: new WorkerSessionStorage(prisma),
      distribution: AppDistribution.AppStore,
      future: {
        expiringOfflineAccessTokens: false,
      },
      ...(env.SHOP_CUSTOM_DOMAIN
        ? { customShopDomains: [env.SHOP_CUSTOM_DOMAIN] }
        : {}),
    });
  }
}

function getShopify(): ShopifyApp {
  if (!globalThis.__shopifyAppInstance) {
    throw new Error(
      "Shopify not initialized. Call initShopify(env) at the start of the request."
    );
  }
  return globalThis.__shopifyAppInstance;
}

// Export getters that access the initialized instance
export const addDocumentResponseHeaders = (...args: Parameters<ShopifyApp["addDocumentResponseHeaders"]>) =>
  getShopify().addDocumentResponseHeaders(...args);
export const authenticate = new Proxy({} as ShopifyApp["authenticate"], {
  get(_, prop) {
    return (getShopify().authenticate as any)[prop];
  },
});
export const unauthenticated = new Proxy({} as ShopifyApp["unauthenticated"], {
  get(_, prop) {
    return (getShopify().unauthenticated as any)[prop];
  },
});
export const login = (...args: Parameters<ShopifyApp["login"]>) =>
  getShopify().login(...args);
export const registerWebhooks = (...args: Parameters<ShopifyApp["registerWebhooks"]>) =>
  getShopify().registerWebhooks(...args);
export const sessionStorage = new Proxy({} as ShopifyApp["sessionStorage"], {
  get(_, prop) {
    return (getShopify().sessionStorage as any)[prop];
  },
});

export default new Proxy({} as ShopifyApp, {
  get(_, prop) {
    return (getShopify() as any)[prop];
  },
});
