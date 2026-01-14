import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SampleRepository } from '../../app/services/hcp-samples/repository';
import { createMockAdminApi, MockAdminApi } from '../fixtures/mock-admin-api';

describe('SampleRepository', () => {
  let repository: SampleRepository;
  let mockAdmin: MockAdminApi;

  beforeEach(() => {
    mockAdmin = createMockAdminApi();
    repository = new SampleRepository(mockAdmin);
  });

  describe('getProductVariant', () => {
    it('should return variant ID for a valid product', async () => {
      mockAdmin.graphql.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            product: {
              variants: {
                edges: [{ node: { id: 'gid://shopify/ProductVariant/1' } }]
              }
            }
          }
        })
      });

      const result = await repository.getProductVariant('123');
      expect(result).toBe('gid://shopify/ProductVariant/1');
    });
  });

  describe('createDraftOrder', () => {
    it('should create a draft order successfully', async () => {
      // Mock both variant lookup and draft order creation
      mockAdmin.graphql
        .mockResolvedValueOnce({ // getProductVariant
          ok: true,
          json: async () => ({
            data: { product: { variants: { edges: [{ node: { id: 'v1' } }] } } }
          })
        })
        .mockResolvedValueOnce({ // draftOrderCreate
          ok: true,
          json: async () => ({
            data: {
              draftOrderCreate: {
                draftOrder: { id: 'd1', name: '#1001' },
                userErrors: []
              }
            }
          })
        });

      const dto: any = { productId: '123', email: 'test@example.com' };
      const result = await repository.createDraftOrder(dto);
      expect(result.id).toBe('d1');
      expect(result.name).toBe('#1001');
    });
  });
});
