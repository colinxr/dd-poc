import type { Customer, CustomerDTO } from "./types";
import { GraphQLError, CustomerCreationError, CustomerAlreadyExistsError } from "./errors";

interface AdminApi {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<Response>;
}

export class CustomerRepository {
  constructor(private admin: AdminApi) {}

  async findByEmail(email: string): Promise<Customer | null> {
    try {
      const query = await this.admin.graphql(
        `query customerByEmail($email: String!) {
          customers(first: 1, query: $email) {
            edges {
              node {
                id
                email
                firstName
                lastName
                tags
              }
            }
          }
        }`,
        { variables: { email: `email:${email}` } },
      );

      if (!query.ok) {
        const errorText = await query.text();
        console.error("GraphQL query failed:", {
          status: query.status,
          statusText: query.statusText,
          body: errorText,
        });
        throw new GraphQLError("Failed to query customers", query.status, undefined, [{ message: errorText }]);
      }

      const result = await query.json();
      if (result.errors) {
        console.error("GraphQL errors in response:", JSON.stringify(result.errors, null, 2));
        throw new GraphQLError(
          "GraphQL query failed",
          400,
          undefined,
          result.errors,
        );
      }
      return result.data?.customers?.edges[0]?.node || null;
    } catch (error) {
      if (error instanceof GraphQLError) throw error;
      console.error("Unexpected error in findByEmail:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new GraphQLError("Failed to fetch customer by email", 500, error, [{ message: errorMessage }]);
    }
  }

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
              tags: ["HCP_PENDING"],
              addresses: [
                {
                  address1: dto.businessAddress,
                  address2: dto.addressLine2,
                  city: dto.city,
                  provinceCode: dto.state,
                  zip: dto.zipCode,
                  countryCode: dto.country,
                  company: dto.institutionName,
                  firstName: dto.firstName,
                  lastName: dto.lastName,
                },
              ],
              metafields: [
                {
                  namespace: "custom",
                  key: "hcp_speciality",
                  value: dto.specialty,
                  type: "single_line_text_field",
                },
                {
                  namespace: "custom",
                  key: "hcp_credentials",
                  value: dto.credentials,
                  type: "single_line_text_field",
                },
                {
                  namespace: "custom",
                  key: "hcp_license",
                  value: dto.licenseNpi,
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
        throw new GraphQLError("Failed to create customer", mutation.status, undefined, [{ message: errorText }]);
      }

      const result = await mutation.json();

      if (result.errors) {
        console.error("GraphQL errors in response:", JSON.stringify(result.errors, null, 2));
        throw new GraphQLError(
          "GraphQL mutation failed",
          400,
          undefined,
          result.errors,
        );
      }

      if (result.data?.customerCreate?.userErrors?.length > 0) {
        console.error("Customer creation user errors:", result.data.customerCreate.userErrors);
        throw new CustomerCreationError(result.data.customerCreate.userErrors);
      }

      return result.data?.customerCreate?.customer;
    } catch (error) {
      if (error instanceof CustomerCreationError) throw error;
      if (error instanceof GraphQLError) throw error;
      console.error("Unexpected error in create:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new GraphQLError("Failed to create customer", 500, error, [{ message: errorMessage }]);
    }
  }
}
