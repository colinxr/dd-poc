import type { ActionFunctionArgs } from "react-router";
import { createContainer } from "../container";
import { ValidationError } from "../services/shared/errors";
import { jsonResponse, CORS_HEADERS } from "../services/shared/api";
import { authenticateAppProxy } from "../services/shared/app-proxy";
import {
  DraftOrderCreationError,
  ProductNotFoundError,
  GraphQLError,
} from "../services/hcp-samples/repository";
import { SampleValidator } from "../services/hcp-samples/validator";

export const loader = async () => {
  return new Response(null, { headers: CORS_HEADERS });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const authResult = await authenticateAppProxy(request);
    if (authResult instanceof Response) return authResult;

    const { admin } = authResult;
    const { SamplesService, SampleValidator } = createContainer(admin);

    const url = new URL(request.url);
    const formType = url.searchParams.get("type") || undefined;

    const formData = await request.formData();
    const validated = SampleValidator.validateFormData(formData, formType);

    const result = await SamplesService.createSampleRequest(validated);

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
