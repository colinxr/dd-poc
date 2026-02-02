import type { SampleDTO, DraftOrder } from "./types";

interface AdminApi {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<Response>;
}

export class SampleRepository {
  constructor(private admin: AdminApi) {}

  private ensureGlobalId(id: string, type: "Product" | "ProductVariant"): string {
    if (id.startsWith("gid://")) {
      return id;
    }
    if (/^\d+$/.test(id)) {
      return `gid://shopify/${type}/${id}`;
    }
    return id;
  }

  async getProductVariant(productId: string): Promise<string | null> {
    try {
      const globalProductId = this.ensureGlobalId(productId, "Product");

      const query = await this.admin.graphql(
        `#graphql
        query productVariants($id: ID!) {
          product(id: $id) {
            variants(first: 1) {
              edges {
                node {
                  id
                }
              }
            }
          }
        }`,
        { variables: { id: globalProductId } },
      );

      if (!query.ok) {
        throw new GraphQLError("Failed to query product", query.status);
      }

      const result = await query.json();
      return result.data?.product?.variants?.edges[0]?.node?.id || null;
    } catch (error) {
      if (error instanceof GraphQLError) throw error;
      throw new GraphQLError("Failed to fetch product variant", 500, error);
    }
  }

  async createDraftOrder(dto: SampleDTO): Promise<DraftOrder> {
    try {
      const variantId = await this.getProductVariant(dto.productId);

      if (!variantId) {
        throw new ProductNotFoundError(dto.productId);
      }

      const mutation = await this.admin.graphql(
        `#graphql
        mutation draftOrderCreate($input: DraftOrderInput!) {
          draftOrderCreate(input: $input) {
            draftOrder {
              id
              name
            }
            userErrors {
              field
              message
            }
          }
        }`,
        {
          variables: {
            input: {
              email: dto.email,
              lineItems: [
                {
                  variantId: variantId,
                  quantity: 1,
                  originalUnitPrice: "0.00",
                  appliedDiscount: {
                    description: "HCP Sample Request - 100% Off",
                    value: 100.0,
                    valueType: "PERCENTAGE",
                  },
                },
              ],
              shippingAddress: {
                firstName: dto.firstName,
                lastName: dto.lastName,
                address1: dto.address1,
                address2: dto.address2 || undefined,
                city: dto.city,
                province: dto.province,
                country: dto.country,
                zip: dto.zip,
                phone: dto.phone || undefined,
              },
              useCustomerDefaultAddress: false,
              note: `HCP Sample Request - ${dto.firstName} ${dto.lastName} - ${dto.email}`,
              metafields: [
                ...(dto.patientEmail
                  ? [
                      {
                        namespace: "custom",
                        key: "patient_email",
                        type: "single_line_text_field",
                        value: dto.patientEmail,
                      },
                    ]
                  : []),
                ...(dto.patientPhone
                  ? [
                      {
                        namespace: "custom",
                        key: "patient_phone",
                        type: "single_line_text_field",
                        value: dto.patientPhone,
                      },
                    ]
                  : []),
              ],
            },
          },
        },
      );

      if (!mutation.ok) {
        throw new GraphQLError("Failed to create draft order", mutation.status);
      }

      const result = await mutation.json();

      if (result.data?.draftOrderCreate?.userErrors?.length > 0) {
        throw new DraftOrderCreationError(result.data.draftOrderCreate.userErrors);
      }

      return result.data?.draftOrderCreate?.draftOrder;
    } catch (error) {
      if (error instanceof ProductNotFoundError) throw error;
      if (error instanceof DraftOrderCreationError) throw error;
      if (error instanceof GraphQLError) throw error;
      throw new GraphQLError("Failed to create draft order", 500, error);
    }
  }
}

export class GraphQLError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public originalError?: unknown,
  ) {
    super(message);
    this.name = "GraphQLError";
  }
}

export class ProductNotFoundError extends Error {
  public statusCode = 404;

  constructor(public productId: string) {
    super("Product not found");
    this.name = "ProductNotFoundError";
  }
}

export class DraftOrderCreationError extends Error {
  public statusCode = 422;

  constructor(
    public errors: Array<{ field: string; message: string }>,
  ) {
    super("Draft order creation failed");
    this.name = "DraftOrderCreationError";
  }
}
