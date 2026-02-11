import type { ActionFunctionArgs } from "react-router";
import { createContainer } from "../container";
import { ValidationError } from "../services/shared/errors";
import { jsonResponse, CORS_HEADERS } from "../services/shared/api";
import { authenticateAppProxy } from "../services/shared/app-proxy";
import {
  CustomerCreationError,
  GraphQLError,
} from "../services/hcp-customer/errors";
import { createCustomerDTO } from "../services/hcp-customer/types";

// Map camelCase field names (from Zod validation) back to snake_case (form field names)
const FIELD_NAME_MAP: Record<string, string> = {
  firstName: "first_name",
  lastName: "last_name",
  licenseNpi: "license_npi",
  institutionName: "institution_name",
};

function mapFieldName(camelCaseField: string): string {
  return FIELD_NAME_MAP[camelCaseField] || camelCaseField;
}

// Map snake_case form fields to camelCase for validation
const SNAKE_TO_CAMEL_MAP: Record<string, string> = {
  first_name: "firstName",
  last_name: "lastName",
  license_npi: "licenseNpi",
  institution_name: "institutionName",
};

function snakeToCamel(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = SNAKE_TO_CAMEL_MAP[key] || key;
    result[camelKey] = value;
  }
  return result;
}

export const loader = async () => {
  return new Response(null, { headers: CORS_HEADERS });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const authResult = await authenticateAppProxy(request);

    if (authResult instanceof Response) {
      const errorText = await authResult.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: errorText };
      }
      return jsonResponse({ error: errorData.error || errorText }, 422);
    }

    const container = createContainer(authResult.admin);
    const CustomerService = container.CustomerService;
    const CustomerValidator = container.CustomerValidator;

    // Handle both FormData and JSON payloads
    let validated;
    const contentType = request.headers.get("content-type") || "";
    
    if (contentType.includes("application/json")) {
      const jsonData = await request.json() as Record<string, unknown>;
      console.log("[HCP Customer] Received JSON payload:", jsonData);
      // Convert snake_case to camelCase for validation
      const camelCaseData = snakeToCamel(jsonData);
      console.log("[HCP Customer] Converted to camelCase:", camelCaseData);
      validated = CustomerValidator.validate(camelCaseData);
    } else {
      const formData = await request.formData();
      console.log("[HCP Customer] Received FormData payload");
      validated = CustomerValidator.validateFormData(formData);
    }
    const customerDto = createCustomerDTO(validated);
    const result = await CustomerService.createCustomer(customerDto);

    return jsonResponse(result);
  } catch (error) {
    if (error instanceof ValidationError) {
      const mappedErrors = error.errors.map((err) => ({
        field: mapFieldName(err.field),
        message: err.message,
      }));
      return jsonResponse({ errors: mappedErrors }, 422);
    }

    if (error instanceof CustomerCreationError) {
      const mappedErrors = error.errors.map((err) => ({
        field: mapFieldName(err.field),
        message: err.message,
      }));
      return jsonResponse({ errors: mappedErrors }, 422);
    }

    if (error instanceof GraphQLError) {
      if (error.statusCode === 401 || error.statusCode === 403) {
        return jsonResponse(
          {
            error: error.message,
            graphqlErrors: error.graphqlErrors,
          },
          error.statusCode,
        );
      }
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

    console.error("[HCP Customer] Unhandled error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return jsonResponse(
      {
        error: errorMessage,
      },
      500,
    );
  }
};
