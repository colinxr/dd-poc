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

    let CustomerService, CustomerValidator;
    try {
      const container = createContainer(authResult.admin);
      CustomerService = container.CustomerService;
      CustomerValidator = container.CustomerValidator;
      console.log(
        "hcp.customer action: Service container created successfully",
      );
    } catch (containerError) {
      console.error(
        "hcp.customer action: Failed to create container:",
        containerError,
      );
      throw containerError;
    }

    const formData = await request.formData();

    const validated = CustomerValidator.validateFormData(formData);
    const customerDto = createCustomerDTO(validated);
    const result = await CustomerService.createCustomer(customerDto);

    return jsonResponse(result);
  } catch (error) {
    if (error instanceof ValidationError) {
      return jsonResponse(
        { error: error.errors.map((e: any) => e.message).join(", ") },
        422,
      );
    }

    if (error instanceof CustomerCreationError) {
      return jsonResponse(
        {
          error: error.errors.map((e: any) => e.message).join(", "),
        },
        422,
      );
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

    return jsonResponse(
      {
        error: error.message || "Unknown error occurred",
      },
      500,
    );
  }
};
