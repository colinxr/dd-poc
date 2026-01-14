import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { createContainer } from "../container";
import { ValidationError } from "../services/shared/errors";
import {
  DraftOrderCreationError,
  ProductNotFoundError,
  GraphQLError,
} from "../services/hcp-samples/repository";

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
    const { admin } = await authenticate.public.appProxy(request);

    if (!admin) {
      console.error("App proxy authentication failed - no admin context");
      return new Response(
        JSON.stringify({
          error: "Authentication failed",
          message: "Unable to authenticate app proxy request",
        }),
        { status: 401, headers: CORS_HEADERS },
      );
    }

    const container = createContainer(admin);
    const service = container.HcpSamplesService;

    const formData = await request.formData();
    const result = await service.createSampleRequest(formData);

    return new Response(JSON.stringify(result), { headers: CORS_HEADERS });
  } catch (error) {
    if (error instanceof ValidationError) {
      return new Response(JSON.stringify({ errors: error.errors }), {
        status: error.statusCode,
        headers: CORS_HEADERS,
      });
    }
    if (error instanceof ProductNotFoundError) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: error.statusCode,
        headers: CORS_HEADERS,
      });
    }
    if (error instanceof DraftOrderCreationError) {
      return new Response(JSON.stringify({ errors: error.errors }), {
        status: error.statusCode,
        headers: CORS_HEADERS,
      });
    }
    if (error instanceof GraphQLError) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: error.statusCode,
        headers: CORS_HEADERS,
      });
    }
    console.error("Unexpected error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: CORS_HEADERS,
    });
  }
};
