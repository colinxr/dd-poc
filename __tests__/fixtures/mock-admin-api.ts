import { vi } from 'vitest';

export const createMockAdminApi = () => ({
  graphql: vi.fn(),
});

export type MockAdminApi = ReturnType<typeof createMockAdminApi>;
