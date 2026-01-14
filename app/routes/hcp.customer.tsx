import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { createContainer } from "../container";
import { ValidationError } from "../services/shared/errors";
import {
  CustomerCreationError,
  CustomerAlreadyExistsError,
  GraphQLError,
} from "../services/hcp-customer/errors";

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  return new Response(null, { headers: CORS_HEADERS });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const context = await authenticate.public.appProxy(request);

    if (!context.admin) {
      console.error("App proxy authentication failed - no admin context");
      return new Response(
        JSON.stringify({
          error: "Authentication failed",
          message: "Unable to authenticate app proxy request",
        }),
        { status: 401, headers: CORS_HEADERS },
      );
    }

    const container = createContainer(context.admin);
    const service = container.HcpCustomerService;

    const formData = await request.formData();
    const result = await service.createCustomer(formData);

    return new Response(JSON.stringify(result), { headers: CORS_HEADERS });
  } catch (error) {
    if (error instanceof ValidationError) {
      return new Response(JSON.stringify({ errors: error.errors }), {
        status: error.statusCode,
        headers: CORS_HEADERS,
      });
    }
    if (error instanceof CustomerAlreadyExistsError) {
      return new Response(
        JSON.stringify({
          status: "error",
          code: error.statusCode,
          errors: [
            {
              field: "email",
              message: "A customer with this email already exists",
            },
          ],
          existingCustomerId: error.existingCustomerId,
        }),
        { status: error.statusCode, headers: CORS_HEADERS },
      );
    }
    if (error instanceof CustomerCreationError) {
      return new Response(
        JSON.stringify({
          status: "error",
          code: error.statusCode,
          errors: error.errors,
        }),
        { status: error.statusCode, headers: CORS_HEADERS },
      );
    }
    if (error instanceof GraphQLError) {
      return new Response(
        JSON.stringify({
          status: "error",
          code: error.statusCode,
          error: error.message,
          graphqlErrors: error.graphqlErrors,
        }),
        { status: error.statusCode, headers: CORS_HEADERS },
      );
    }
    console.error("Unexpected error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: CORS_HEADERS,
    });
  }
};
