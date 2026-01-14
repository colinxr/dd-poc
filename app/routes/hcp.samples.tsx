import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { createContainer } from "../container";
import { ValidationError } from "../services/shared/errors";
import {
  DraftOrderCreationError,
  ProductNotFoundError,
  GraphQLError,
} from "../services/hcp-samples/repository";

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const { admin } = await authenticate.public.appProxy(request);

    if (!admin) {
      console.error("App proxy authentication failed - no admin context");
      return new Response(
        JSON.stringify({
          error: "Authentication failed",
          message: "Unable to authenticate app proxy request",
        }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }

    const container = createContainer(admin);
    const service = container.HcpSamplesService;

    const formData = await request.formData();
    const result = await service.createSampleRequest(formData);

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
    if (error instanceof ProductNotFoundError) {
      return Response.json(
        { error: error.message },
        { status: error.statusCode },
      );
    }
    if (error instanceof DraftOrderCreationError) {
      return Response.json(
        { errors: error.errors },
        { status: error.statusCode },
      );
    }
    if (error instanceof GraphQLError) {
      return Response.json(
        { error: error.message },
        { status: error.statusCode },
      );
    }
    console.error("Unexpected error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
};
