import type { ActionFunctionArgs } from "react-router";
import { createContainer } from "../container";
import { ValidationError } from "../services/shared/errors";
import { jsonResponse, CORS_HEADERS } from "../services/shared/api";
import { authenticateAppProxy } from "../services/shared/app-proxy";
import {
  CustomerCreationError,
  CustomerAlreadyExistsError,
  GraphQLError,
} from "../services/hcp-customer/errors";
import { CustomerValidator } from "../services/hcp-customer/validator";
import { createCustomerDTO } from "../services/hcp-customer/types";

export const loader = async () => {
  return new Response(null, { headers: CORS_HEADERS });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const authResult = await authenticateAppProxy(request);
    if (authResult instanceof Response) return authResult;

    const { CustomerService, CustomerValidator } = createContainer(
      authResult.admin,
    );

    const formData = await request.formData();
    const validated = CustomerValidator.validateFormData(formData);
    const customerDto = createCustomerDTO(validated);

    const result = await CustomerService.createCustomer(customerDto);

    return jsonResponse(result);
  } catch (error) {
    if (error instanceof ValidationError) {
      return jsonResponse({ errors: error.errors }, error.statusCode);
    }

    if (error instanceof CustomerCreationError) {
      return jsonResponse(
        {
          status: "error",
          code: error.statusCode,
          errors: error.errors,
        },
        error.statusCode,
      );
    }

    if (error instanceof CustomerAlreadyExistsError) {
      return jsonResponse(
        {
          error: error.message,
          existingCustomerId: error.existingCustomerId,
        },
        error.statusCode,
      );
    }

    if (error instanceof GraphQLError) {
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

    console.error("Unexpected error:", error);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
};
