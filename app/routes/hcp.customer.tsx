import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { createContainer } from "../container";
import { ValidationError } from "../services/shared/errors";
import {
  CustomerCreationError,
  CustomerAlreadyExistsError,
  GraphQLError,
} from "../services/hcp-customer/errors";

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
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }

    const container = createContainer(context.admin);
    const service = container.HcpCustomerService;

    const formData = await request.formData();

    const result = await service.createCustomer(formData);

    return Response.json(result, {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return Response.json(
        { errors: error.errors },
        { status: error.statusCode },
      );
    }
    if (error instanceof CustomerAlreadyExistsError) {
      return Response.json(
        {
          status: "error",
          code: error.statusCode,
          errors: [
            {
              field: "email",
              message: "A customer with this email already exists",
            },
          ],
          existingCustomerId: error.existingCustomerId,
        },
        { status: error.statusCode },
      );
    }
    if (error instanceof CustomerCreationError) {
      return Response.json(
        {
          status: "error",
          code: error.statusCode,
          errors: error.errors,
        },
        { status: error.statusCode },
      );
    }
    if (error instanceof GraphQLError) {
      return Response.json(
        {
          status: "error",
          code: error.statusCode,
          error: error.message,
          graphqlErrors: error.graphqlErrors,
        },
        { status: error.statusCode },
      );
    }
    console.error("Unexpected error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
};
