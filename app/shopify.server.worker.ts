import "@shopify/shopify-api/adapters/web-api";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-react-router/server";
import { WorkerSessionStorage } from "./worker-session-storage";
import prisma from "./db.server";

export const apiVersion = ApiVersion.October25;

// Lazy initialization - shopifyApp reads process.env at first access, not at module load
let _shopify: ReturnType<typeof shopifyApp> | null = null;

function getShopify() {
  if (!_shopify) {
    _shopify = shopifyApp({
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
  return _shopify;
}

// Export getters that lazily initialize shopify on first access
export const addDocumentResponseHeaders = (...args: Parameters<ReturnType<typeof shopifyApp>["addDocumentResponseHeaders"]>) =>
  getShopify().addDocumentResponseHeaders(...args);
export const authenticate = new Proxy({} as ReturnType<typeof shopifyApp>["authenticate"], {
  get(_, prop) {
    return (getShopify().authenticate as any)[prop];
  },
});
export const unauthenticated = new Proxy({} as ReturnType<typeof shopifyApp>["unauthenticated"], {
  get(_, prop) {
    return (getShopify().unauthenticated as any)[prop];
  },
});
export const login = (...args: Parameters<ReturnType<typeof shopifyApp>["login"]>) =>
  getShopify().login(...args);
export const registerWebhooks = (...args: Parameters<ReturnType<typeof shopifyApp>["registerWebhooks"]>) =>
  getShopify().registerWebhooks(...args);
export const sessionStorage = new Proxy({} as ReturnType<typeof shopifyApp>["sessionStorage"], {
  get(_, prop) {
    return (getShopify().sessionStorage as any)[prop];
  },
});

export default new Proxy({} as ReturnType<typeof shopifyApp>, {
  get(_, prop) {
    return (getShopify() as any)[prop];
  },
});
