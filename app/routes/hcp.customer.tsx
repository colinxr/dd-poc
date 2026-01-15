import type { ActionFunctionArgs } from "react-router";
import { authenticate, unauthenticated } from "../shopify.server";
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

    if (!context.session?.shop) {
      console.error("App proxy authentication failed - no shop in session");
      return jsonResponse(
        {
          error: "Authentication failed",
          message: "Unable to authenticate app proxy request",
        },
        401,
      );
    }

    const shop = context.session.shop;

    // App proxy requests don't include an access token, so we need to fetch
    // the offline session for this shop to make Admin API calls
    let admin;
    try {
      const result = await unauthenticated.admin(shop);
      admin = result.admin;
    } catch (sessionError) {
      console.error(
        "Failed to get admin session for shop:",
        shop,
        sessionError,
      );
      return jsonResponse(
        {
          error: "Session not found",
          message: `No offline session found for shop: ${shop}. The app may need to be reinstalled.`,
        },
        401,
      );
    }

    const { CustomerService } = createContainer(admin);

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
