# Shopify App - React Router + Cloudflare Workers

A Shopify embedded app built with **React Router v7** that runs on **Cloudflare Workers** (edge runtime) for production, with Node.js for local development.

This is a fork of the [official Shopify React Router template](https://github.com/Shopify/shopify-app-template-react-router), modified to support Cloudflare's edge runtime instead of Node.js.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Dual Environment Strategy](#dual-environment-strategy)
3. [Key Files & Entry Points](#key-files--entry-points)
4. [The "File Swapping" Mechanism](#the-file-swapping-mechanism)
5. [State Management (The Cloudflare Challenge)](#state-management-the-cloudflare-challenge)
6. [Database (Prisma + D1)](#database-prisma--d1)
7. [Services Layer](#services-layer)
8. [Setup & Development](#setup--development)
9. [Deployment](#deployment)
10. [Common Patterns](#common-patterns)

---

## Architecture Overview

This app is designed to work in **two distinct environments**:

| Aspect             | Local Development                  | Production                             |
| ------------------ | ---------------------------------- | -------------------------------------- |
| **Runtime**        | Node.js                            | Cloudflare Workers (Edge)              |
| **Server Adapter** | `@react-router/node`               | `@react-router/cloudflare`             |
| **Database**       | SQLite (`file:dev.sqlite`)         | Cloudflare D1                          |
| **Prisma Client**  | Singleton on `global`              | Request-scoped via `AsyncLocalStorage` |
| **SSR Streams**    | Node.js Streams (`PipeableStream`) | Web Streams (`ReadableStream`)         |
| **Build Config**   | `vite.config.ts`                   | `vite.worker.config.ts`                |

---

## Dual Environment Strategy

The core challenge with Cloudflare Workers is that they **lack Node.js APIs**. We cannot use `process.env`, Node.js streams, or global singletons in the same way.

To solve this, we maintain **platform-specific implementations** for infrastructure code (entry points, database, Shopify config) while keeping business logic (routes, services, UI) platform-agnostic.

### Build-Time File Swapping

A custom Vite plugin intercepts imports during the production build and redirects them to Cloudflare-compatible files:

| Import (Routes/Services)                          | Build Result                      |
| ------------------------------------------------- | --------------------------------- |
| `import { authenticate } from "~/shopify.server"` | Uses `shopify.server.worker.ts`   |
| `import prisma from "~/db.server"`                | Uses D1 adapter instead of SQLite |

---

## Key Files & Entry Points

```
app/
├── entry.server.tsx           # Node.js SSR entry (local)
├── entry.server.worker.tsx    # Cloudflare SSR entry (production)
├── entry.worker.ts            # Cloudflare fetch handler (production)
├── shopify.server.ts          # Node.js Shopify init (local)
├── shopify.server.worker.ts   # Cloudflare Shopify init (production)
├── db.server.ts               # Prisma client (runtime detection)
└── worker-session-storage.ts  # Session storage (shared)
```

### Entry Points Comparison

| File                      | Purpose                                                                     |
| ------------------------- | --------------------------------------------------------------------------- |
| `entry.server.tsx`        | Uses `renderToPipeableStream` + Node streams.                               |
| `entry.server.worker.tsx` | Uses `renderToReadableStream` + Web streams.                                |
| `entry.worker.ts`         | The main Cloudflare fetch handler. Initializes Shopify + DB before routing. |

---

## The "File Swapping" Mechanism

`vite.worker.config.ts` contains a custom Vite plugin (`shopify-server-redirect`) that runs **before** TypeScript resolution. It intercepts imports of Node.js-specific files and redirects them to their Worker counterparts.

```typescript
// vite.worker.config.ts
{
  name: "shopify-server-redirect",
  enforce: "pre",
  resolveId(source) {
    if (source.endsWith("/shopify.server")) {
      return "./app/shopify.server.worker.ts";
    }
    if (source.endsWith("/entry.server")) {
      return "./app/entry.server.worker.tsx";
    }
  }
}
```

This allows your routes to import from `~/shopify.server` without knowing which environment they're running in.

---

## State Management (The Cloudflare Challenge)

### The Problem

In Node.js, you typically initialize global clients at module scope:

```typescript
// Node.js style (works because process.env is available at build/start time)
const shopify = shopifyApp({ apiKey: process.env.SHOPIFY_API_KEY });
export const authenticate = shopify.authenticate;
```

In Cloudflare Workers, `process.env` is **undefined** at module load time. Environment variables only exist inside the `fetch(request, env)` handler.

### The Solution: Lazy Initialization + Proxies

We use a "Bridge" pattern:

1.  **Request Starts**: `entry.worker.ts` calls `initShopify(env)` with runtime secrets.
2.  **Route Imports**: Routes import `authenticate` (a Proxy object).
3.  **Route Calls**: When `authenticate.admin(request)` is called, the Proxy forwards it to the initialized instance.

```typescript
// shopify.server.worker.ts
let appInstance: ShopifyApp | undefined;

export function initShopify(env: ShopifyEnv) {
  appInstance = shopifyApp({ apiKey: env.SHOPIFY_API_KEY, ... });
}

// The Proxy "waits" for initShopify to be called
export const authenticate = new Proxy({}, {
  get(_, prop) {
    return getApp().authenticate[prop]; // getApp() throws if not initialized
  }
});
```

---

## Database (Prisma + D1)

### The Abstraction

`app/db.server.ts` exports a Prisma client that automatically switches implementation:

- **Node.js**: Uses `new PrismaClient()` with SQLite. Singleton pattern prevents connection exhaustion.
- **Cloudflare**: Uses `new PrismaClient({ adapter: new PrismaD1(env.DB) })`. Request-scoped pattern required because D1 binding is unique per request.

### Request Scoping

Cloudflare requires the D1 client to be created **per request** (the binding comes from the runtime). We use `AsyncLocalStorage` to make the client available to the app without passing it through every function:

```typescript
// entry.worker.ts
const prisma = createPrismaClient({ DB: env.DB });
prismaStorage.run(prisma, () => handleRequest(...));
```

Anywhere in your app, you can simply `import prisma from "~/db.server"` and it will resolve to the correct client for the current request.

---

## Services Layer

The app follows a **Repository + Validator + Service** pattern for clean separation of concerns. This architecture is used for all business logic including HCP customer and sample management.

### Directory Structure

```
app/services/
├── hcp-customer/           # HCP customer creation service
│   ├── constants.ts        # Constants (e.g., customer tags)
│   ├── dto.ts              # Data transfer objects & form parsers
│   ├── errors.ts           # Domain-specific error classes
│   ├── repository.ts       # GraphQL operations for customers
│   ├── service.ts          # Business logic orchestration
│   ├── types.ts            # TypeScript interfaces
│   └── validator.ts        # Zod validation schemas
├── hcp-samples/            # Sample request service (same pattern)
└── shared/
    ├── api.ts              # JSON response helpers
    └── errors.ts           # Base error classes (ValidationError)
```

### Request Flow

```
HTTP Request (POST /hcp/customer)
         |
         v
┌─────────────────────────────────────────────────────────────┐
│ app/routes/hcp.customer.tsx                                 │
│ 1. authenticate.public.appProxy(request) - Validate app     │
│    proxy request and get session                            │
│ 2. unauthenticated.admin(shop) - Get admin API access token │
│ 3. createContainer(admin) - Create DI container             │
│ 4. CustomerService.createCustomer(formData) - Call service  │
│ 5. Return JSON response with error handling                 │
└─────────────────────────────────────────────────────────────┘
         |
         v
┌─────────────────────────────────────────────────────────────┐
│ CustomerService (app/services/hcp-customer/service.ts)    │
│ 1. CustomerRepository.create(dto) - Create customer         │
│    (Shopify mutation handles duplicate email validation)    │
│ 2. Return { customer, message }                             │
└─────────────────────────────────────────────────────────────┘
         |
         v
┌─────────────────────────────────────────────────────────────┐
│ CustomerRepository (app/services/hcp-customer/repository.ts) │
│ - Executes GraphQL queries/mutations against Shopify Admin  │
│ - Handles error responses and userErrors                    │
└─────────────────────────────────────────────────────────────┘
```

### Dependency Injection Container

**File:** `app/container/index.ts`

The app uses **BottleJS** for dependency injection with a factory pattern:

```typescript
export function createContainer(admin: AdminApi) {
  const bottle = new Bottle();

  // Infrastructure - shared admin API client
  bottle.value("adminApi", admin);

  // Validators - singletons (stateless)
  bottle.service("CustomerValidator", CustomerValidator);
  bottle.service("SampleValidator", SampleValidator);

  // Repositories - request-scoped (need adminApi)
  bottle.factory(
    "CustomerRepository",
    (container) => new CustomerRepository(container.adminApi),
  );

  // Services - orchestrate repository + validator
  bottle.factory(
    "CustomerService",
    (container) =>
      new CustomerService(
        container.CustomerRepository,
        container.CustomerValidator,
      ),
  );

  return bottle.container;
}
```

| Pattern            | Method          | Use Case                  |
| ------------------ | --------------- | ------------------------- |
| `bottle.value()`   | Shared instance | Infrastructure (adminApi) |
| `bottle.service()` | Singleton       | Stateless validators      |
| `bottle.factory()` | New instance    | Classes with dependencies |

### Layer Responsibilities

| Layer          | File                                  | Responsibility                        |
| -------------- | ------------------------------------- | ------------------------------------- |
| **Route**      | `routes/hcp.customer.tsx`             | HTTP handling, auth, DI orchestration |
| **Service**    | `services/hcp-customer/service.ts`    | Business logic orchestration          |
| **Repository** | `services/hcp-customer/repository.ts` | Data access (GraphQL)                 |
| **Validator**  | `services/hcp-customer/validator.ts`  | Input validation                      |

### Service Layer Example

```typescript
// app/services/hcp-customer/service.ts
export class CustomerService {
  constructor(
    private repo: CustomerRepository,
    private validator: CustomerValidator,
  ) {}

  async createCustomer(formData: FormData) {
    // 1. Parse form data to DTO
    const dto = CustomerFormParser.fromFormData(formData);

    // 2. Validate input (throws ValidationError on failure)
    this.validator.validate(dto);

    // 3. Check for duplicates
    const existing = await this.repo.findByEmail(dto.email);
    if (existing) throw new ValidationError([...]);

    // 4. Create customer
    const customer = await this.repo.create(dto);
    return { customer, message: "HCP customer created successfully" };
  }
}
```

### Zod Validation

```typescript
// app/services/hcp-customer/validator.ts
export const CreateCustomerSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email(),
  specialty: z.string().min(1).max(100),
  credentials: z.string().min(1).max(50),
  licenseNpi: z
    .string()
    .regex(/^\d{10}$/, "NPI must be 10 digits")
    .optional()
    .default(""),
  institutionName: z.string().min(1).max(200),
  businessAddress: z.string().min(1).max(255),
  addressLine2: z.string().max(255).optional().default(""),
  city: z.string().min(1).max(100),
  state: z.string().min(2).max(50),
  zipCode: z.string().regex(/^\d{5}(-\d{4})?$/, "Invalid ZIP code format"),
  country: z.string().length(2).default("US"),
});

export class CustomerValidator {
  validate(data: unknown): ValidatedCustomerInput {
    const result = CreateCustomerSchema.safeParse(data);
    if (!result.success) {
      const errors = result.error.issues.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      throw new ValidationError(errors);
    }
    return result.data;
  }
}
```

### GraphQL Operations

The repository handles all Shopify Admin API interactions:

```typescript
// app/services/hcp-customer/repository.ts
async findByEmail(email: string): Promise<Customer | null> {
  const query = await this.admin.graphql(
    `query customerByEmail($email: String!) {
      customers(first: 1, query: $email) {
        edges {
          node {
            id, email, firstName, lastName, tags
          }
        }
      }
    }`,
    { variables: { email: `email:${email}` } }
  );
  return result.data?.customers?.edges[0]?.node || null;
}

async create(dto: CustomerDTO): Promise<Customer> {
  const mutation = await this.admin.graphql(
    `mutation customerCreate($input: CustomerInput!) {
      customerCreate(input: $input) {
        customer { id, email, firstName, lastName, tags }
        userErrors { field, message }
      }
    }`,
    {
      variables: {
        input: {
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: dto.email,
          tags: dto.tags,
          addresses: [{ /* address fields */ }],
          metafields: [
            { namespace: "hcp", key: "speciality", value: dto.specialty, type: "single_line_text_field" },
            { namespace: "hcp", key: "credentials", value: dto.credentials, type: "single_line_text_field" },
            { namespace: "hcp", key: "license", value: dto.licenseNpi, type: "single_line_text_field" },
          ],
        },
      },
    }
  );
  return result.data?.customerCreate?.customer;
}
```

### Error Handling

| Error                   | File                     | Status  | Use Case                               |
| ----------------------- | ------------------------ | ------- | -------------------------------------- |
| `ValidationError`       | `shared/errors.ts`       | 400     | Zod validation failures                |
| `GraphQLError`          | `hcp-customer/errors.ts` | 500/400 | GraphQL HTTP/network errors            |
| `CustomerCreationError` | `hcp-customer/errors.ts` | 422     | Shopify validation errors (userErrors) |

**Route Error Handling:**

```typescript
try {
  const result = await CustomerService.createCustomer(formData);
  return jsonResponse(result);
} catch (error) {
  if (error instanceof ValidationError) {
    return jsonResponse({ errors: error.errors }, error.statusCode);
  }
  if (error instanceof CustomerCreationError) {
    return jsonResponse(
      { status: "error", code: error.statusCode, errors: error.errors },
      error.statusCode,
    );
  }
  if (error instanceof GraphQLError) {
    return jsonResponse(
      {
        status: "error",
        code: error.statusCode,
        error: error.message,
        graphqlErrors: error.graphqlErrors,
      },
      error.statusCode,
    );
  }
  console.error("Unexpected error:", error);
  return jsonResponse({ error: "Internal server error" }, 500);
}
```

### Adding a New Service

1. **Create service directory** in `app/services/`:

   ```
   app/services/new-feature/
   ├── constants.ts
   ├── dto.ts
   ├── errors.ts
   ├── repository.ts
   ├── service.ts
   ├── types.ts
   └── validator.ts
   ```

2. **Register in DI container** (`app/container/index.ts`):

   ```typescript
   bottle.factory(
     "NewFeatureService",
     (container) =>
       new NewFeatureService(
         container.NewFeatureRepository,
         container.NewFeatureValidator,
       ),
   );
   ```

3. **Use in route**:

   ```typescript
   const { NewFeatureService } = createContainer(admin);
   const result = await NewFeatureService.doSomething(data);
   ```

---

## Setup & Development

### Prerequisites

- Node.js 20+
- Cloudflare account
- Shopify Partner account

### Environment Variables

Create a `.env` file:

```bash
# Local development (Node.js)
SHOPIFY_API_KEY=...
SHOPIFY_API_SECRET=...
SHOPIFY_APP_URL=http://localhost:3000
SCOPES=read_products,write_products
```

### Commands

```bash
# Start local dev server (Node.js)
npm run dev

# Build for production (Cloudflare)
npm run build:worker

# Deploy to Cloudflare Workers
npm run deploy

# Open Prisma Studio (local)
npm run prisma studio
```

---

## Deployment

### Wrangler Configuration

`wrangler.toml` defines the Cloudflare infrastructure:

```toml
name = "your-app"
main = "./build/server/index.js"
compatibility_date = "2025-08-05"

[[d1_databases]]
binding = "DB"
database_name = "your-app-db"
database_id = "your-d1-id"
```

### Required Secrets

Set these in Cloudflare Dashboard or via wrangler:

```bash
npx wrangler secret put SHOPIFY_API_KEY
npx wrangler secret put SHOPIFY_API_SECRET
npx wrangler secret put SCOPES
npx wrangler secret put SESSION_SECRET
```

### Database Migrations

After deploying, run migrations on your D1 database:

```bash
npx wrangler d1 execute your-db --remote --file=./prisma/migrations/latest.sql
```

---

## Common Patterns

### Adding New Environment Variables

1.  **Add to `wrangler.toml`**:

    ```toml
    [vars]
    NEW_FEATURE_FLAG = true
    ```

2.  **Add to `app/shopify.server.worker.ts`**:

    ```typescript
    export interface ShopifyEnv {
      // ... existing fields
      NEW_FEATURE_FLAG?: string;
    }
    ```

3.  **Use in request**:
    ```typescript
    export function initShopify(env: ShopifyEnv) {
      if (env.NEW_FEATURE_FLAG) { ... }
    }
    ```

### Adding Database Tables

1.  **Edit `prisma/schema.prisma`**:

    ```prisma
    model MyTable {
      id String @id
      createdAt DateTime @default(now())
    }
    ```

2.  **Generate migration**:

    ```bash
    npx prisma migrate dev --name add_my_table
    ```

3.  **Deploy migration**:
    ```bash
    npx wrangler d1 execute your-db --remote --file=./prisma/migrations/YYYYMMDDHHMMSS_add_my_table.sql
    ```

---

## Resources

- [React Router v7 Docs](https://reactrouter.com/)
- [Shopify App React Router](https://shopify.dev/docs/api/shopify-app-react-router)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [Prisma with D1](https://www.prisma.io/docs/orm/overview/databases/cloudflare-d1)
