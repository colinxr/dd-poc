import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { createContainer } from "../container";
import { ValidationError } from "../services/shared/errors";
import { jsonResponse, CORS_HEADERS } from "../services/shared/api";
import {
  CustomerCreationError,
  GraphQLError,
  CustomerAlreadyExistsError,
} from "../services/hcp-customer/errors";

export const loader = async () => {
  return new Response(null, { headers: CORS_HEADERS });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const context = await authenticate.public.appProxy(request);

    if (!context.admin) {
      console.error("App proxy authentication failed - no admin context");
      return jsonResponse(
        {
          error: "Authentication failed",
          message: "Unable to authenticate app proxy request",
        },
        401,
      );
    }

    const { CustomerService } = createContainer(context.admin);

    const formData = await request.formData();
    const result = await CustomerService.createCustomer(formData);

    return jsonResponse(result);
  } catch (error) {
    if (error instanceof ValidationError) {
      return jsonResponse({ errors: error.errors }, error.statusCode);
    }

    if (error instanceof CustomerAlreadyExistsError) {
      return jsonResponse(
        {
          status: "error",
          code: error.statusCode,
          errors: [{ field: "email", message: error.message }],
        },
        error.statusCode,
      );
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
