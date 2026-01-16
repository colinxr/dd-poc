# Cloudflare KV Caching Guide for RR-DD-POC

## Overview

Cloudflare KV (Key-Value) is a fast, global key-value store. It's perfect for caching data that:
- Is read frequently
- Changes infrequently
- Doesn't require complex queries

**Why KV over D1 for caching?**
| Metric | D1 | KV |
|--------|----|----|
| Read latency | ~5-20ms | ~5-15ms |
| Write latency | ~50-100ms | ~10-30ms |
| Cost | $5/10M reads | $5/100M reads |
| Best for | Relational data | Simple key-value lookups |

---

## 1. Setup: Add KV Binding to wrangler.toml

First, add KV namespaces and bindings:

```toml
# wrangler.toml

name = "rr-dd-poc"
compatibility_date = "2025-01-16"

# Existing D1 database
[[d1_databases]]
binding = "DB"
database_name = "rr-dd-poc-db"
database_id = "your-database-id"

# NEW: KV Namespace for caching
[[kv_namespaces]]
binding = "CACHE"
id = "your-kv-namespace-id"  # Create with: npx wrangler kv:namespace create "CACHE"

# Optional: Second namespace for webhook idempotency
[[kv_namespaces]]
binding = "WEBHOOKS"
id = "your-webhook-kv-id"
```

**Create the KV namespace:**
```bash
npx wrangler kv:namespace create "CACHE" --env production
```

This will add the KV binding to your `wrangler.toml` automatically.

---

## 2. Create KV Caching Utility

Create a reusable caching layer:

```typescript
// app/lib/kv-cache.ts

interface CacheOptions {
  /** Time-to-live in seconds (default: 1 hour) */
  ttl?: number;
  /** Namespace binding (defaults to CACHE) */
  binding?: string;
}

/**
 * Get value from KV cache
 */
export async function getCache<T>(
  key: string,
  options: CacheOptions = {}
): Promise<T | null> {
  const { ttl = 3600 } = options;
  
  try {
    // In worker runtime, access via env.CACHE
    const cache = getCacheBinding();
    const value = await cache.get(key);
    
    if (!value) return null;
    
    return JSON.parse(value) as T;
  } catch (error) {
    console.warn(`Cache read error for key ${key}:`, error);
    return null;
  }
}

/**
 * Set value in KV cache
 */
export async function setCache<T>(
  key: string,
  value: T,
  options: CacheOptions = {}
): Promise<void> {
  const { ttl = 3600 } = options;
  
  try {
    const cache = getCacheBinding();
    await cache.put(key, JSON.stringify(value), { expirationTtl: ttl });
  } catch (error) {
    console.warn(`Cache write error for key ${key}:`, error);
  }
}

/**
 * Delete from KV cache
 */
export async function deleteCache(key: string): Promise<void> {
  try {
    const cache = getCacheBinding();
    await cache.delete(key);
  } catch (error) {
    console.warn(`Cache delete error for key ${key}:`, error);
  }
}

/**
 * Delete multiple keys (pattern-based)
 * Note: Cloudflare KV doesn't support pattern deletion natively
 * You need to track keys or use a secondary index
 */
export async function deleteCachePattern(prefix: string): Promise<void> {
  try {
    const cache = getCacheBinding();
    
    // List all keys with the prefix
    const list = await cache.list({ prefix });
    
    // Delete each key
    await Promise.all(
      list.keys.map((key) => cache.delete(key.name))
    );
  } catch (error) {
    console.warn(`Cache pattern delete error for prefix ${prefix}:`, error);
  }
}

/**
 * Get or set pattern - fetch from cache, fallback to source, cache result
 */
export async function getOrSetCache<T>(
  key: string,
  fetchFn: () => Promise<T>,
  options: CacheOptions = {}
): Promise<T> {
  // Try cache first
  const cached = await getCache<T>(key, options);
  if (cached) return cached;
  
  // Fetch from source
  const value = await fetchFn();
  
  // Cache the result
  await setCache(key, value, options);
  
  return value;
}

// Helper to get the KV binding
function getCacheBinding() {
  if (process.env.TARGET === "worker") {
    // In Cloudflare runtime, env is passed through
    // This function should be called after env is available
    // See section on how to make env available globally
    return (globalThis as any).__env?.CACHE;
  }
  // For local development, you might want a mock or skip caching
  return {
    get: async () => null,
    put: async () => {},
    delete: async () => {},
    list: async () => ({ keys: [] }),
  };
}
```

---

## 3. Make KV Available Globally

The challenge: `env` is only available in the `fetch` handler. We need it accessible in services.

```typescript
// app/lib/kv-globals.ts

// Extend globalThis to hold environment bindings
declare global {
  var __env: {
    CACHE?: KVNamespace;
    WEBHOOKS?: KVNamespace;
    DB?: D1Database;
    SHOPIFY_API_KEY?: string;
    SHOPIFY_API_SECRET?: string;
    // ... other env vars
  } | undefined;
}

/**
 * Initialize global environment bindings
 * Call this at the start of every request
 */
export function initGlobals(env: Env): void {
  globalThis.__env = {
    CACHE: env.CACHE,
    WEBHOOKS: env.WEBHOOKS,
    DB: env.DB,
    SHOPIFY_API_KEY: env.SHOPIFY_API_KEY,
    SHOPIFY_API_SECRET: env.SHOPIFY_API_SECRET,
  };
}
```

Update `entry.worker.ts`:

```typescript
// app/entry.worker.ts
import { initGlobals } from "~/lib/kv-globals";
import { initShopify } from "~/shopify.server.worker";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    // Initialize globals FIRST
    initGlobals(env);
    
    // Then init Shopify
    initShopify(env);
    
    // ... rest of handler
  }
};
```

Now services can access KV via `globalThis.__env.CACHE`.

---

## 4. Cache Shopify API Calls

The `findByEmail` query is a perfect candidate for caching since:
- Email lookups are frequent
- Customer data doesn't change often
- Slow GraphQL query (100-500ms) can be cached to <10ms

```typescript
// app/services/hcp-customer/repository.ts

import type { Customer, CustomerDTO } from "./types";
import { GraphQLError, CustomerCreationError } from "./errors";
import { getCache, setCache, deleteCache } from "~/lib/kv-cache";

interface AdminApi {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<Response>;
}

export class CustomerRepository {
  constructor(private admin: AdminApi) {}

  async findByEmail(email: string): Promise<Customer | null> {
    // Try cache first
    const cacheKey = `customer:email:${email.toLowerCase()}`;
    const cached = await getCache<Customer>(cacheKey, { ttl: 1800 }); // 30 min cache
    
    if (cached) {
      console.log(`Cache hit for ${email}`);
      return cached;
    }
    
    console.log(`Cache miss for ${email}, querying Shopify...`);
    
    // Cache miss - query Shopify
    const query = await this.admin.graphql(
      `query customerByEmail($email: String!) {
        customers(first: 1, query: $email) {
          edges {
            node {
              id
              email
              firstName
              lastName
              tags
            }
          }
        }
      }`,
      { variables: { email: `email:${email}` } },
    );

    // ... (error handling as before)
    
    const result = await query.json();
    const customer = result.data?.customers?.edges[0]?.node || null;
    
    // Cache the result (only if found)
    if (customer) {
      await setCache(cacheKey, customer, { ttl: 1800 });
    }
    
    return customer;
  }

  async create(dto: CustomerDTO): Promise<Customer> {
    // ... create logic (unchanged)
    
    const customer = result.data?.customerCreate?.customer;
    
    // Invalidate cache when customer is created
    if (customer) {
      const cacheKey = `customer:email:${dto.email.toLowerCase()}`;
      await deleteCache(cacheKey); // Clear stale cache
    }
    
    return customer;
  }
}
```

---

## 5. Webhook Idempotency

Prevent duplicate webhook processing:

```typescript
// app/lib/webhook-idempotency.ts

import { getCache, setCache } from "~/lib/kv-cache";

interface WebhookPayload {
  topic: string;
  shop: string;
  payload: unknown;
}

/**
 * Check if webhook was already processed
 * Returns true if duplicate (skip processing)
 */
export async function isDuplicateWebhook(
  topic: string,
  shop: string,
  payload: Record<string, unknown>,
): Promise<boolean> {
  // Generate idempotency key from payload
  // Use fields that uniquely identify this webhook
  const idempotencyKey = `${topic}:${shop}:${
    payload.id || JSON.stringify(payload)
  }`;
  
  // Try to acquire lock (atomically check-and-set)
  const existing = await getCache<string>(`webhook:lock:${idempotencyKey}`);
  
  if (existing === "processing") {
    return true; // Already being processed
  }
  
  // Mark as processing
  await setCache(`webhook:lock:${idempotencyKey}`, "processing", { ttl: 300 });
  
  return false;
}

/**
 * Mark webhook as complete
 */
export async function completeWebhook(
  topic: string,
  shop: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const idempotencyKey = `${topic}:${shop}:${
    payload.id || JSON.stringify(payload)
  }`;
  
  // Store result for 24 hours (useful for debugging)
  await setCache(`webhook:result:${idempotencyKey}`, {
    processedAt: new Date().toISOString(),
    topic,
    shop,
  }, { ttl: 86400 });
}

/**
 * Check if webhook was already processed (for at-least-once delivery)
 */
export async function wasWebhookProcessed(
  topic: string,
  shop: string,
  payload: Record<string, unknown>,
): Promise<boolean> {
  const idempotencyKey = `${topic}:${shop}:${
    payload.id || JSON.stringify(payload)
  }`;
  
  const result = await getCache(`webhook:result:${idempotencyKey}`);
  return result !== null;
}
```

Usage in webhook handler:

```typescript
// app/routes/webhooks.app.uninstalled.tsx

import { authenticate } from "~/shopify.server.worker";
import { isDuplicateWebhook, completeWebhook } from "~/lib/webhook-idempotency";

export async function action({ request }: ActionFunctionArgs) {
  const { topic, shop, payload } = await authenticate.webhook(request);
  
  // Check for duplicate
  if (await isDuplicateWebhook(topic, shop, payload)) {
    console.log(`Duplicate webhook ${topic} for ${shop}, skipping`);
    return new Response("OK", { status: 200 });
  }
  
  try {
    // Process webhook
    switch (topic) {
      case "APP_UNINSTALLED":
        await handleAppUninstalled(shop, payload);
        break;
      // ... other topics
    }
    
    // Mark complete
    await completeWebhook(topic, shop, payload as Record<string, unknown>);
    
    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error(`Error processing webhook ${topic}:`, error);
    return new Response("Error", { status: 500 });
  }
}
```

---

## 6. Cache Shop Configuration

Shop settings rarely change—perfect for caching:

```typescript
// app/lib/shop-config.ts

import { getCache, setCache } from "~/lib/kv-cache";

interface ShopConfig {
  shopId: string;
  shopName: string;
  features: {
    hcpEnabled: boolean;
    samplesEnabled: boolean;
    maxSamplesPerRequest: number;
  };
  updatedAt: string;
}

/**
 * Get shop configuration (cached)
 */
export async function getShopConfig(shop: string): Promise<ShopConfig | null> {
  return getOrSetCache(
    `shop:config:${shop}`,
    async () => {
      // Fetch from database
      const prisma = await import("~/db.server").then((m) => m.default);
      const shopConfig = await prisma.shopConfig.findUnique({
        where: { shop },
      });
      
      if (!shopConfig) return null;
      
      return {
        shopId: shopConfig.shopId,
        shopName: shopConfig.shopName,
        features: {
          hcpEnabled: shopConfig.hcpEnabled,
          samplesEnabled: shopConfig.samplesEnabled,
          maxSamplesPerRequest: shopConfig.maxSamplesPerRequest,
        },
        updatedAt: shopConfig.updatedAt.toISOString(),
      };
    },
    { ttl: 86400 } // 24 hour cache
  );
}

/**
 * Invalidate shop config cache when updated
 */
export async function invalidateShopConfig(shop: string): Promise<void> {
  await deleteCache(`shop:config:${shop}`);
}
```

---

## 7. Cache Statistics & Monitoring

Track cache effectiveness:

```typescript
// app/lib/cache-stats.ts

interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  errors: number;
}

const stats: CacheStats = {
  hits: 0,
  misses: 0,
  sets: 0,
  deletes: 0,
  errors: 0,
};

export function recordHit() { stats.hits++; }
export function recordMiss() { stats.misses++; }
export function recordSet() { stats.sets++; }
export function recordDelete() { stats.deletes++; }
export function recordError() { stats.errors++; }

export function getCacheStats(): CacheStats {
  const total = stats.hits + stats.misses;
  const hitRate = total > 0 ? (stats.hits / total) * 100 : 0;
  
  return {
    ...stats,
    hitRate: hitRate.toFixed(1) + "%",
  };
}

// In your routes, expose stats
export async function loader() {
  return json({ cacheStats: getCacheStats() });
}
```

---

## 8. Cache Invalidation Strategy

When to invalidate:

| Data Type | Invalidation Trigger |
|-----------|---------------------|
| Customer (by email) | Customer updated, deleted |
| Shop config | Config updated |
| Session | User logs out, session expires |
| Webhook idempotency | 24 hours (automatic TTL) |

```typescript
// app/lib/cache-invalidation.ts

import { deleteCache, deleteCachePattern } from "~/lib/kv-cache";

/**
 * Invalidate all caches related to a customer
 */
export async function invalidateCustomerCaches(customerId: string, email: string): Promise<void> {
  await Promise.all([
    deleteCache(`customer:email:${email.toLowerCase()}`),
    deleteCache(`customer:id:${customerId}`),
    // Invalidate list caches if you have them
    deleteCachePattern(`customer:list:${customerId}`),
  ]);
}

/**
 * Invalidate all caches related to a shop
 */
export async function invalidateShopCaches(shop: string): Promise<void> {
  await Promise.all([
    deleteCache(`shop:config:${shop}`),
    deleteCachePattern(`customer:shop:${shop}`),
    deleteCachePattern(`sample:shop:${shop}`),
  ]);
}
```

---

## 9. Cost Analysis

KV pricing at typical usage:

| Operation | Free Tier | Paid Tier |
|-----------|-----------|-----------|
| Reads | 100K/day | 10M/month = $5 |
| Writes | 1K/day | 1M/month = $5 |
| Deletes | Unlimited | Unlimited |
| Storage | 1GB | 1GB = $0.25/month |

**For RR-DD-POC at 100K requests/day:**
- Cache reads: ~50K-100K/day (free tier covers)
- Cache writes: ~100-1K/day (free tier covers)
- **Monthly cost: $0**

---

## 10. Quick Reference

```typescript
// Cache a value
await setCache("key", value, { ttl: 3600 });

// Get a value
const value = await getCache("key");

// Get or set pattern
const value = await getOrSetCache("key", fetchFn, { ttl: 3600 });

// Delete
await deleteCache("key");

// Pattern delete
await deleteCachePattern("prefix:");

// Checkpoint (for idempotency)
await setCache(`lock:${key}`, "processing", { ttl: 300 });
```

---

## 11. Checklist Before Production

- [ ] Create KV namespace in Cloudflare dashboard or CLI
- [ ] Add binding to `wrangler.toml`
- [ ] Implement `initGlobals()` in `entry.worker.ts`
- [ ] Create `kv-cache.ts` utility
- [ ] Add caching to `findByEmail()` in repository
- [ ] Add cache invalidation on writes
- [ ] Add webhook idempotency
- [ ] Test cache invalidation
- [ ] Monitor cache hit rate in production
