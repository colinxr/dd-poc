# AGENTS.md - RR-DD-POC Shopify App

This document provides guidance for AI agents working on the RR-DD-POC Shopify app.

## Project Overview

RR-DD-POC is a Shopify embedded app built with **React Router v7** for managing Healthcare Professional (HCP) customers and sample requests. It uses:
- **React Router v7** with file-based routing via `@react-router/fs-routes`
- **BottleJS** for dependency injection
- **Zod** for schema validation
- **Prisma** for database (SQLite local, D1 production)
- **Vitest** for testing
- **Shopify App Bridge** for embedded app UI
- **Cloudflare Workers** for production deployment

## Dual Environment Architecture

This app runs on **Node.js** locally and **Cloudflare Workers** in production. Since Cloudflare's edge runtime lacks Node.js APIs, we maintain parallel implementations for platform-specific code.

### Environment Comparison

| Aspect | Local Development | Production |
|--------|-------------------|------------|
| Runtime | Node.js | Cloudflare Workers (edge) |
| Server adapter | `@react-router/node` | `@react-router/cloudflare` |
| SSR streaming | `renderToPipeableStream` (Node streams) | `renderToReadableStream` (Web streams) |
| Database | SQLite (`file:dev.sqlite`) | Cloudflare D1 |
| Prisma client | Singleton on `globalThis` | Request-scoped via `AsyncLocalStorage` |
| Env vars | `process.env.*` | Worker `env` parameter |
| Shopify adapter | `@shopify/.../adapters/node` | `@shopify/shopify-api/adapters/web-api` |
| Entry point | `app/entry.server.tsx` | `app/entry.worker.ts` |
| Shopify config | `app/shopify.server.ts` | `app/shopify.server.worker.ts` |
| Build config | `vite.config.ts` | `vite.worker.config.ts` |
| Dev command | `npm run dev` | `npm run deploy` |

### How File Switching Works

The `vite.worker.config.ts` uses a custom Vite plugin (`shopify-server-redirect`) that rewrites imports at build time:

```typescript
// When TARGET=worker, these imports get redirected:
"~/shopify.server" → "~/shopify.server.worker.ts"
"~/entry.server"   → "~/entry.server.worker.tsx"
```

This allows routes and services to import from `~/shopify.server` without knowing which environment they're in.

### Shopify Initialization Differences

**Node (module-level singleton)** — `shopify.server.ts`:
```typescript
// Initialized once when module loads
const shopify = shopifyApp({ apiKey: process.env.SHOPIFY_API_KEY, ... });
export const authenticate = shopify.authenticate;
```

**Cloudflare (lazy per-request)** — `shopify.server.worker.ts`:
```typescript
// Must be called each request with runtime env
export function initShopify(env: Env) {
  globalThis.__shopifyAppInstance = shopifyApp({ apiKey: env.SHOPIFY_API_KEY, ... });
}
// Exports are proxies that delegate to the initialized instance
export const authenticate = new Proxy({}, { get: (_, prop) => getInstance().authenticate[prop] });
```

### Database Client Differences

**Node** — Uses a singleton pattern:
```typescript
globalThis.prismaGlobal ??= new PrismaClient();
```

**Cloudflare** — Uses `AsyncLocalStorage` for request-scoped clients:
```typescript
// entry.worker.ts
const prisma = new PrismaClient({ adapter: new PrismaD1(env.DB) });
prismaStorage.run(prisma, () => handleRequest(...));
```

The `db.server.ts` file exports a Proxy that detects the runtime via `process.env.TARGET === "worker"` and retrieves the client from the appropriate source.

### Worker Entry Point Flow

`entry.worker.ts` is the Cloudflare Worker's `fetch` handler:

```typescript
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    initShopify(env);                        // 1. Initialize Shopify with runtime secrets
    const prisma = createPrismaClient(env);  // 2. Create D1-backed Prisma client
    
    return prismaStorage.run(prisma, () =>   // 3. Scope client to this request
      requestHandler(request, { cloudflare: { env, ctx } })
    );
  }
}
```

## Directory Structure

```
rr-dd-poc/
├── app/
│   ├── container/           # DI container setup
│   ├── routes/              # Route files (file-based routing)
│   ├── services/            # Business logic layer
│   │   ├── hcp-customer/    # Customer creation service
│   │   ├── hcp-samples/     # Sample request service
│   │   └── shared/          # Shared utilities
│   ├── root.tsx             # App root component
│   │
│   │   # Node.js entry points (local development)
│   ├── entry.server.tsx     # SSR with Node streams
│   ├── shopify.server.ts    # Module-level Shopify init
│   │
│   │   # Cloudflare entry points (production)
│   ├── entry.worker.ts      # Worker fetch handler (main entry)
│   ├── entry.server.worker.tsx  # SSR with Web streams
│   ├── shopify.server.worker.ts # Per-request Shopify init
│   │
│   │   # Shared (works in both environments)
│   ├── db.server.ts         # Prisma client (runtime detection)
│   ├── worker-session-storage.ts  # Shopify session storage
│   └── routes.ts            # Route config (flatRoutes)
│
├── __tests__/               # Test files
│   ├── fixtures/            # Mock data, DI container
│   ├── unit/                # Unit tests
│   └── integration/         # Route integration tests
├── prisma/
│   ├── schema.prisma        # Database schema (SQLite provider, works with D1)
│   └── schema.mjs           # D1 adapter config (production)
├── vite.config.ts           # Dev build config (Node.js)
├── vite.worker.config.ts    # Prod build config (Cloudflare) with import redirects
├── wrangler.toml            # Cloudflare Workers config with D1 binding
├── .github/
│   └── workflows/
│       └── deploy.yml       # CI/CD pipeline
├── vitest.config.ts
├── tsconfig.json
├── shopify.app.toml
└── package.json
```

## Routing

### Route Configuration

Routes are auto-generated using `@react-router/fs-routes` in `app/routes.ts`:
```typescript
export default flatRoutes();
```

### Route Structure

| Route | File | Purpose |
|-------|------|---------|
| `/` | `routes/_index/route.tsx` | Landing page with login form |
| `/auth/login` | `routes/auth.login/route.tsx` | Admin authentication |
| `/auth/*` | `routes/auth.$.tsx` | Auth fallback |
| `/app` | `routes/app._index.tsx` | Main app dashboard |
| `/app/additional` | `routes/app.additional.tsx` | Secondary app page |
| `/apps/hcp` | `routes/apps.hcp.tsx` | HCP apps layout |
| `/hcp/customer` | `routes/hcp.customer.tsx` | **App Proxy** - Create HCP customers |
| `/hcp/samples` | `routes/hcp.samples.tsx` | **App Proxy** - Create sample requests |
| `/webhooks/app/uninstalled` | `routes/webhooks.app.uninstalled.tsx` | Handle app uninstallation |
| `/webhooks/app/scopes_update` | `routes/webhooks.app.scopes_update.tsx` | Handle scope updates |

### Route Handler Pattern

```typescript
import { authenticate } from "@shopify/shopify-app-react-router/server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return json({ data: ... });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  return json({ result: ... });
};

export default function RouteComponent() {
  const data = useLoaderData<typeof loader>();
  return <JSX />;
}
```

### Authentication Methods

- `authenticate.admin(request)` - For embedded app routes
- `authenticate.public.appProxy(request)` - For app proxy routes (`/hcp/*`)
- `authenticate.webhook(request)` - For webhook verification

## Services Layer Pattern

The app follows a **Repository + Validator + Service** pattern:

```
Service Layer
├── HcpCustomerService    # Orchestrates customer creation
├── HcpSamplesService     # Orchestrates sample requests
├── CustomerValidator     # Zod validation for customer data
├── SampleValidator       # Zod validation for sample data
├── CustomerRepository    # GraphQL operations for customers
├── SampleRepository      # GraphQL operations for samples
└── shared/errors.ts      # Shared error classes
```

### Error Handling Pattern

```typescript
// Validation errors (400)
return Response.json({ errors: error.errors }, { status: 400 });

// Domain errors (409, 422)
return Response.json({ error: error.message }, { status: error.statusCode });

// Unexpected errors (500)
return Response.json({ error: "Internal server error" }, { status: 500 });
```

## Testing

### Configuration

- **Test Runner**: Vitest with happy-dom
- **Test Pattern**: `__tests__/**/*.{test,spec}.{ts,tsx}`
- **Globals**: Enabled (no need to import vitest functions)

### Test Commands

```bash
npm test              # All tests
npm run test:unit     # Unit tests only
npm run test:integration  # Integration tests only
npm run test:coverage # With coverage report
```

### Test Structure

```
__tests__/
├── fixtures/
│   ├── container.ts         # DI container for tests
│   ├── mock-admin-api.ts    # Mock Shopify Admin API
│   └── mock-data.ts         # Test data constants
├── unit/
│   ├── customer-validator.test.ts
│   ├── customer-repository.test.ts
│   ├── sample-validator.test.ts
│   └── sample-repository.test.ts
└── integration/
    └── routes/
        ├── hcp.customer.test.ts
        └── hcp.samples.test.ts
```

### Unit Test Pattern

```typescript
describe('Service/Feature', () => {
  let mockAdmin: MockAdminApi;
  
  beforeEach(() => {
    mockAdmin = createMockAdminApi();
  });
  
  it('should do expected behavior', async () => {
    // Test implementation
  });
});
```

### Integration Test Pattern

```typescript
describe('Route', () => {
  vi.mock("~/shopify.server", () => ({
    authenticate: {
      public: {
        appProxy: vi.fn(),
      },
    },
  }));
  
  it('should handle action', async () => {
    const response = await action({ request: mockRequest });
    expect(response.status).toBe(200);
  });
});
```

## Common Commands

```bash
# Local Development (Shopify + SQLite)
npm run dev              # Start Shopify dev server
npm run lint             # Run ESLint
npm run typecheck        # Run React Router typegen and TypeScript check
npm run build            # React Router build
npm run start            # Production server (local)
npm run setup            # Prisma generate and migrate
npm run prisma studio    # Open Prisma GUI
npx prisma db push       # Push schema to database
npx prisma migrate dev   # Run migrations
npm run graphql-codegen  # Generate GraphQL types

# Cloudflare Workers (Production)
npm run dev:wrangler     # Local Cloudflare dev server
npm run deploy           # Build and deploy to Cloudflare Workers
npm run deploy:prod      # Deploy to production environment
npx wrangler d1 execute rr-dd-poc-db --remote --file=./prisma/migrations/latest.sql
npx wrangler d1 create rr-dd-poc-db --remote

# Testing
npm test              # All tests
npm run test:unit     # Unit tests only
npm run test:integration  # Integration tests only
npm run test:coverage # With coverage report
```

## Key Files

### Core Application
| File | Purpose |
|------|---------|
| `app/routes.ts` | Auto-generates routes from `app/routes/` files |
| `app/container/index.ts` | DI container with BottleJS |
| `app/db.server.ts` | Prisma client with runtime detection (singleton vs AsyncLocalStorage) |
| `app/worker-session-storage.ts` | Custom Shopify session storage (works with both SQLite and D1) |

### Platform-Specific Entry Points
| File | Environment | Purpose |
|------|-------------|---------|
| `app/entry.server.tsx` | Node.js | SSR with `renderToPipeableStream` |
| `app/entry.server.worker.tsx` | Cloudflare | SSR with `renderToReadableStream` |
| `app/entry.worker.ts` | Cloudflare | Worker `fetch` handler (main entry) |
| `app/shopify.server.ts` | Node.js | Module-level Shopify init |
| `app/shopify.server.worker.ts` | Cloudflare | Lazy per-request Shopify init |

### Build Configuration
| File | Purpose |
|------|---------|
| `vite.config.ts` | Development build (Node.js) |
| `vite.worker.config.ts` | Production build (Cloudflare) — contains import redirects |
| `wrangler.toml` | Cloudflare Workers config with D1 binding |
| `prisma/schema.mjs` | Prisma D1 adapter configuration |

### Services Layer
| File | Purpose |
|------|---------|
| `app/services/*/repository.ts` | GraphQL operations for Shopify Admin API |
| `app/services/*/validator.ts` | Zod schema validation |
| `app/services/*/service.ts` | Business logic orchestration |

### Routes
| File | Purpose |
|------|---------|
| `app/routes/hcp.customer.tsx` | App proxy route for customer creation |
| `app/routes/hcp.samples.tsx` | App proxy route for sample requests |

### Testing & Config
| File | Purpose |
|------|---------|
| `__tests__/fixtures/container.ts` | Test container with mocked dependencies |
| `vitest.config.ts` | Test configuration |
| `shopify.app.toml` | Shopify app configuration |
| `.github/workflows/deploy.yml` | CI/CD deployment pipeline |

## App Proxy Configuration

The app uses Shopify's **App Proxy** for public-facing endpoints:

- **Proxy Prefix**: `/apps`
- **Proxy URL**: `/hcp`
- **Public Routes**: `/hcp/customer`, `/hcp/samples`

These routes use `authenticate.public.appProxy()` and are accessible without Shopify admin login.

## Dependencies

### Key Dependencies

| Package | Purpose |
|---------|---------|
| `@react-router/dev` | React Router v7 build tools |
| `@react-router/fs-routes` | File-based route generation |
| `@react-router/node` | Node.js runtime adapter (local) |
| `@react-router/cloudflare` | Cloudflare Workers adapter (production) |
| `@shopify/shopify-app-react-router` | Shopify React Router adapter |
| `@prisma/client` | Prisma ORM |
| `@prisma/adapter-d1` | D1 database adapter (production) |
| `@cloudflare/workers-types` | Cloudflare type definitions |
| `bottlejs` | Dependency injection container |
| `zod` | Schema validation |
| `prisma` | Database ORM |
| `wrangler` | Cloudflare CLI |

## Cloudflare Workers Deployment

### Configuration Files

- `wrangler.toml` - Cloudflare Workers configuration with D1 binding
- `prisma/schema.mjs` - Prisma D1 adapter configuration
- `app/entry.worker.ts` - Cloudflare Workers entry point

### Environment Variables (GitHub Secrets)

| Secret | Purpose |
|--------|---------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API authentication |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account identifier |
| `CLOUDFLARE_DATABASE_ID` | D1 database identifier |
| `CLOUDFLARE_D1_TOKEN` | D1 database token |
| `SHOPIFY_API_KEY` | Shopify API key |
| `SHOPIFY_API_SECRET` | Shopify API secret |
| `SHOPIFY_SCOPES` | Shopify permission scopes |
| `SESSION_SECRET` | Session encryption key |

### Deployment Commands

```bash
# Build and deploy to production
npm run deploy

# Deploy to production environment
npm run deploy:prod

# Local Cloudflare development
npm run dev:wrangler

# Create remote D1 database
npm run db:create:remote

# Run migrations on remote D1
npm run db:migrate:remote
```

### CI/CD Pipeline

The project uses GitHub Actions for automated deployment:

- **Trigger**: Push to `main` branch
- **Steps**: Install → Prisma generate → Build → Deploy → Run migrations
- **Secrets**: All sensitive values stored in GitHub repository secrets

### D1 Database Setup

```bash
# Create D1 database
npx wrangler d1 create rr-dd-poc-db --remote

# Set database ID in wrangler.toml or GitHub secrets

# Apply schema migrations
npx wrangler d1 execute rr-dd-poc-db --remote --file=./prisma/migrations/latest.sql
```

### Local Development with D1

```bash
# Run with local D1 (optional)
npx wrangler dev --local

# Execute commands against local D1
npx wrangler d1 execute local-db --local --command="SELECT * FROM Session"
```

## TypeScript Configuration

- **Target**: ES2022
- **DOM**: Enabled
- **Path Aliases**: `~/*` maps to `app/*`

## VS Code

The project includes `.cursor/mcp.json` for Cursor IDE MCP configuration.

## Notes

- The app uses Shopify Admin GraphQL API for data operations
- Form data is parsed using `Object.fromEntries()` and validated with Zod
- Repositories use `admin.graphql()` for GraphQL operations
- Session storage is handled by Prisma
- Webhooks are configured in `shopify.app.toml` with API version 2026-04
- Local development uses SQLite database (`file:dev.sqlite`)
- Production uses Cloudflare D1 database with Prisma D1 adapter
- The `app/db.server.ts` conditionally creates Prisma client based on environment
