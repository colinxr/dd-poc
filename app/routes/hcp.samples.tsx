import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { createContainer } from "../container";
import { ValidationError } from "../services/shared/errors";
import { jsonResponse, CORS_HEADERS } from "../services/shared/api";
import {
  DraftOrderCreationError,
  ProductNotFoundError,
  GraphQLError,
} from "../services/hcp-samples/repository";

export const loader = async () => {
  return new Response(null, { headers: CORS_HEADERS });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const { admin } = await authenticate.public.appProxy(request);

    if (!admin) {
      console.error("App proxy authentication failed - no admin context");
      return jsonResponse(
        {
          error: "Authentication failed",
          message: "Unable to authenticate app proxy request",
        },
        401,
      );
    }

    const { SamplesService } = createContainer(admin);

    const formData = await request.formData();
    const result = await SamplesService.createSampleRequest(formData);

    return jsonResponse(result);
  } catch (error) {
    if (error instanceof ValidationError) {
      return jsonResponse({ errors: error.errors }, error.statusCode);
    }
    if (error instanceof ProductNotFoundError) {
      return jsonResponse({ error: error.message }, error.statusCode);
    }
    if (error instanceof DraftOrderCreationError) {
      return jsonResponse({ errors: error.errors }, error.statusCode);
    }
    if (error instanceof GraphQLError) {
      return jsonResponse({ error: error.message }, error.statusCode);
    }
    console.error("Unexpected error:", error);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
};
