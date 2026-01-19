import { describe, it, expect, vi, beforeEach } from "vitest";
import { action } from "../../../app/routes/hcp.customer";
import { authenticate, unauthenticated } from "../../../app/shopify.server";
import { MOCK_CUSTOMER_DATA, createFormData } from "../../fixtures/mock-data";

vi.mock("../../../app/shopify.server", () => ({
  authenticate: {
    public: {
      appProxy: vi.fn(),
    },
  },
  unauthenticated: {
    admin: vi.fn(),
  },
}));

describe("hcp.customer route action", () => {
  let mockAdmin: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdmin = {
      graphql: vi.fn(),
    };
    (authenticate.public.appProxy as any).mockResolvedValue({
      session: { shop: "test-shop.myshopify.com" },
    });
    (unauthenticated.admin as any).mockResolvedValue({ admin: mockAdmin });
  });

  it("should return 200 and customer data on success", async () => {
    const formData = createFormData(MOCK_CUSTOMER_DATA);
    const request = new Request("https://test.com/hcp/customer", {
      method: "POST",
      body: formData,
    });

    // Mock create
    mockAdmin.graphql.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          customerCreate: {
            customer: { id: "gid://123", email: MOCK_CUSTOMER_DATA.email },
            userErrors: [],
          },
        },
      }),
    });

    const response = await action({ request, params: {}, context: {} } as any);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.customer.id).toBe("gid://123");
    expect(result.message).toBe("HCP customer created successfully");
  });

  it("should return 400 on validation error", async () => {
    const invalidData = { ...MOCK_CUSTOMER_DATA, email: "invalid" };
    const formData = createFormData(invalidData);
    const request = new Request("https://test.com/hcp/customer", {
      method: "POST",
      body: formData,
    });

    const response = await action({ request, params: {}, context: {} } as any);
    const result = await response.json();

    expect(response.status).toBe(400);
    expect(result.errors).toBeDefined();
  });
});
