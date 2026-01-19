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

// --- STATE MANAGEMENT ---
// In Cloudflare, module-scope variables persist between requests in the same isolate.
// We use these singletons to store the initialized app and its config key.
let appInstance: ShopifyApp<any> | undefined;
let currentApiKey: string | undefined;

export interface ShopifyEnv {
  SHOPIFY_API_KEY: string;
  SHOPIFY_API_SECRET: string;
  SHOPIFY_APP_URL?: string;
  SCOPES?: string;
  SHOP_CUSTOM_DOMAIN?: string;
}

// --- INITIALIZATION ---
// This must be called at the start of every request (in entry.worker.ts)
// because that is the only time we have access to the 'env' variables.
export function initShopify(env: ShopifyEnv) {
  // If already initialized with the same key, skip to save resources
  if (appInstance && currentApiKey === env.SHOPIFY_API_KEY) {
    return;
  }

  currentApiKey = env.SHOPIFY_API_KEY;

  appInstance = shopifyApp({
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

// Internal helper to enforce initialization
function getApp(): ShopifyApp<any> {
  if (!appInstance) {
    throw new Error(
      "ShopifyApp not initialized! Ensure initShopify(env) is called in entry.worker.ts",
    );
  }
  return appInstance;
}

// --- THE BRIDGE (EXPORTS) ---
// These exports allow routes to import functions statically, even though
// the implementation is loaded lazily at request time.

// 1. Simple Function Wrappers (Forward calls to the instance)
export const login = (...args: any[]) => (getApp() as any).login(...args);

export const registerWebhooks = (
  ...args: Parameters<ShopifyApp<any>["registerWebhooks"]>
) => getApp().registerWebhooks(...args);

export const addDocumentResponseHeaders = (
  ...args: Parameters<ShopifyApp<any>["addDocumentResponseHeaders"]>
) => getApp().addDocumentResponseHeaders(...args);

// 2. Proxies (Required for objects with properties like .admin, .public)
export const authenticate = new Proxy({} as ShopifyApp<any>["authenticate"], {
  get: (_, prop) => (getApp().authenticate as any)[prop],
});

export const unauthenticated = new Proxy(
  {} as ShopifyApp<any>["unauthenticated"],
  {
    get: (_, prop) => (getApp().unauthenticated as any)[prop],
  },
);

export const sessionStorage = new Proxy(
  {} as ShopifyApp<any>["sessionStorage"],
  {
    get: (_, prop) => (getApp().sessionStorage as any)[prop],
  },
);

export default new Proxy({} as ShopifyApp<any>, {
  get: (_, prop) => (getApp() as any)[prop],
});
