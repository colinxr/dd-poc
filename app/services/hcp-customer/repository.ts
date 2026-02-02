import { HCP_CUSTOMER_TAG } from "./constants";
import type { Customer, CustomerDTO } from "./types";
import { GraphQLError, CustomerCreationError } from "./errors";
import { m } from "node_modules/react-router/dist/development/index-react-server-client-IoJGLOqV.mjs";

interface AdminApi {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<Response>;
}

export class CustomerRepository {
  constructor(private admin: AdminApi) {}

  async create(dto: CustomerDTO): Promise<Customer> {
    try {
      const mutation = await this.admin.graphql(
        `mutation customerCreate($input: CustomerInput!) {
          customerCreate(input: $input) {
            customer {
              id
              email
              firstName
              lastName
              tags
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
              firstName: dto.firstName,
              lastName: dto.lastName,
              email: dto.email,
              tags: dto.tags,
              addresses: [
                {
                  address1: dto.addressLine1,
                  address2: dto.address2,
                  city: dto.city,
                  provinceCode: dto.province,
                  zip: dto.zip,
                  countryCode: dto.country,
                  company: dto.institutionName,
                  firstName: dto.firstName,
                  lastName: dto.lastName,
                },
              ],
              metafields: [
                {
                  namespace: "hcp",
                  key: "speciality",
                  value: dto.specialty,
                  type: "single_line_text_field",
                },
                {
                  namespace: "hcp",
                  key: "credentials",
                  value: dto.credentials,
                  type: "single_line_text_field",
                },
                {
                  namespace: "hcp",
                  key: "license",
                  value: dto.licenseNpi,
                  type: "single_line_text_field",
                },
                {
                  namespace: "hcp",
                  key: "institution",
                  value: dto.institutionName,
                  type: "single_line_text_field",
                },
              ],
            },
          },
        },
      );

      if (!mutation.ok) {
        const errorText = await mutation.text();
        console.error("GraphQL mutation failed:", {
          status: mutation.status,
          statusText: mutation.statusText,
          body: errorText,
        });
        throw new GraphQLError(
          "Failed to create customer",
          mutation.status,
          undefined,
          [{ message: errorText }],
        );
      }

      const result = await mutation.json();

      if (result.errors) {
        console.error(
          "GraphQL errors in response:",
          JSON.stringify(result.errors, null, 2),
        );
        throw new GraphQLError(
          "GraphQL mutation failed",
          400,
          undefined,
          result.errors,
        );
      }

      if (result.data?.customerCreate?.userErrors?.length > 0) {
        throw new CustomerCreationError(result.data.customerCreate.userErrors);
      }

      return result.data?.customerCreate?.customer;
    } catch (error) {
      if (error instanceof CustomerCreationError) throw error;
      if (error instanceof GraphQLError) throw error;
      console.error("Unexpected error in create:", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new GraphQLError("Failed to create customer", 500, error, [
        { message: errorMessage },
      ]);
    }
  }
}
