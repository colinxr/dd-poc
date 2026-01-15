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

// Store shopify instance in globalThis to survive module reloads and prevent Rollup optimization
declare global {
  var __shopifyApp: ShopifyApp | undefined;
}

function getShopify(): ShopifyApp {
  if (!globalThis.__shopifyApp) {
    // This check prevents Rollup from hoisting - it can't prove globalThis state at build time
    if (typeof globalThis === "undefined") {
      throw new Error("globalThis not available");
    }
    globalThis.__shopifyApp = shopifyApp({
      apiKey: process.env.SHOPIFY_API_KEY,
      apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
      apiVersion: ApiVersion.October25,
      scopes: process.env.SCOPES?.split(","),
      appUrl:
        process.env.SHOPIFY_APP_URL || "https://rr-dd-poc.colinxr.workers.dev",
      authPathPrefix: "/auth",
      sessionStorage: new WorkerSessionStorage(prisma),
      distribution: AppDistribution.AppStore,
      future: {
        expiringOfflineAccessTokens: false,
      },
      ...(process.env.SHOP_CUSTOM_DOMAIN
        ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
        : {}),
    });
  }
  return globalThis.__shopifyApp;
}

// Export getters that lazily initialize shopify on first access
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
