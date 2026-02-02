# Testing Guide

This project uses **Vitest** for testing, with **BottleJS** for dependency injection to facilitate mocking.

## Test Structure

- `__tests__/unit`: Tests for individual classes (Services, Repositories, Validators) in isolation.
- `__tests__/integration`: Tests for route handlers and end-to-end flows.
- `__tests__/fixtures`: Mocks, test containers, and sample data.

## Running Tests

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration

# Run with coverage report
npm run test:coverage

# Run in UI mode
npm run test:ui
```

## Dependency Injection (DI)

We use BottleJS to manage dependencies. This allows us to swap real services for mocks during testing.

### Container Setup

The main container is created in `app/container/index.ts`. It takes the Shopify `admin` API as an argument to provide request-scoped dependencies.

```typescript
const container = createContainer(admin);
const service = container.CustomerService;
```

### Mocking in Tests

In tests, use `createTestContainer()` from `__tests__/fixtures/container.ts` which comes pre-configured with mocked infrastructure.

## Best Practices

1. **Isolation**: Unit tests should never call real APIs or databases. Use the mocked container.
2. **Naming**: Test files should end in `.test.ts` or `.spec.ts`.
3. **Mocks**: Add reusable mock data to `__tests__/fixtures/mock-data.ts`.
4. **Integration**: Integration tests for routes should mock the `shopify.server.ts` module to simulate authentication.
5. **Errors**: Always use the shared error classes in `app/services/shared/errors.ts` and service-specific errors in `errors.ts` to ensure `instanceof` checks work correctly across the app.
