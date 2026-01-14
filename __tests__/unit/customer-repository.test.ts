import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CustomerRepository } from '../../app/services/hcp-customer/repository';
import { createMockAdminApi, MockAdminApi } from '../fixtures/mock-admin-api';

describe('CustomerRepository', () => {
  let repository: CustomerRepository;
  let mockAdmin: MockAdminApi;

  beforeEach(() => {
    mockAdmin = createMockAdminApi();
    repository = new CustomerRepository(mockAdmin);
  });

  describe('findByEmail', () => {
    it('should return customer when found', async () => {
      mockAdmin.graphql.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            customers: {
              edges: [{ node: { id: 'gid://123', email: 'test@example.com' } }]
            }
          }
        })
      });

      const result = await repository.findByEmail('test@example.com');
      expect(result).toBeDefined();
      expect(result?.email).toBe('test@example.com');
      expect(mockAdmin.graphql).toHaveBeenCalled();
    });

    it('should return null when customer not found', async () => {
      mockAdmin.graphql.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            customers: {
              edges: []
            }
          }
        })
      });

      const result = await repository.findByEmail('notfound@example.com');
      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should create customer successfully', async () => {
      const dto: any = { firstName: 'John', email: 'john@example.com' };
      mockAdmin.graphql.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            customerCreate: {
              customer: { id: 'gid://new', email: 'john@example.com' },
              userErrors: []
            }
          }
        })
      });

      const result = await repository.create(dto);
      expect(result.id).toBe('gid://new');
    });
  });
});
