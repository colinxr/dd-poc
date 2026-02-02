import { describe, it, expect, vi, beforeEach } from "vitest";
import { action } from "../../../app/routes/hcp.samples";
import { authenticate, unauthenticated } from "../../../app/shopify.server";
import { MOCK_SAMPLE_DATA, createFormData } from "../../fixtures/mock-data";

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

describe("hcp.samples route action", () => {
  let mockAdmin: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdmin = {
      graphql: vi.fn(),
    };
    (authenticate.public.appProxy as any).mockResolvedValue({
      session: { shop: "test-shop.myshopify.com" },
      admin: mockAdmin,
    });
    (unauthenticated.admin as any).mockResolvedValue({ admin: mockAdmin });
  });

  it("should return 200 and order data on success", async () => {
    const formData = createFormData(MOCK_SAMPLE_DATA);
    const request = new Request("https://test.com/hcp/samples", {
      method: "POST",
      body: formData,
    });

    // Mock getProductVariant
    mockAdmin.graphql.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: { product: { variants: { edges: [{ node: { id: "v1" } }] } } },
      }),
    });

    // Mock draftOrderCreate
    mockAdmin.graphql.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          draftOrderCreate: {
            draftOrder: { id: "d1", name: "#1001" },
            userErrors: [],
          },
        },
      }),
    });

    const response = await action({ request, params: {}, context: {} } as any);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.draftOrderId).toBe("d1");
    expect(result.orderNumber).toBe("#1001");
  });

  it("should return 422 on validation error", async () => {
    const invalidData = { ...MOCK_SAMPLE_DATA, product: "" };
    const formData = createFormData(invalidData);
    const request = new Request("https://test.com/hcp/samples", {
      method: "POST",
      body: formData,
    });

    const response = await action({ request, params: {}, context: {} } as any);
    const result = await response.json();

    expect(response.status).toBe(422);
    expect(result.errors).toBeDefined();
  });

  it("should succeed for direct-to-patient request with patientEmail", async () => {
    const patientData = { ...MOCK_SAMPLE_DATA, patient_email: "patient@example.com" };
    const formData = createFormData(patientData);
    const request = new Request("https://test.com/hcp/samples?type=patient", {
      method: "POST",
      body: formData,
    });

    mockAdmin.graphql
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { product: { variants: { edges: [{ node: { id: "v1" } }] } } },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            draftOrderCreate: {
              draftOrder: { id: "d1", name: "#1001" },
              userErrors: [],
            },
          },
        }),
      });

    const response = await action({ request, params: {}, context: {} } as any);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.draftOrderId).toBe("d1");
  });

  it("should return 422 for direct-to-patient request without patientEmail", async () => {
    const formData = createFormData(MOCK_SAMPLE_DATA); // No patient_email
    const request = new Request("https://test.com/hcp/samples?type=patient", {
      method: "POST",
      body: formData,
    });

    const response = await action({ request, params: {}, context: {} } as any);
    const result = await response.json();

    expect(response.status).toBe(422);
    expect(result.errors.some((e: any) => e.field === "patient_email")).toBe(true);
  });
});
