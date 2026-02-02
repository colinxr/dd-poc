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
  console.log("tk");
  return new Response(null, { headers: CORS_HEADERS });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  console.log("hcp.customer action: Starting form submission processing");

  try {
    console.log("hcp.customer action: Authenticating app proxy request");
    const authResult = await authenticateAppProxy(request);
    console.log("hcp.customer action: Auth result:", authResult);

    if (authResult instanceof Response) {
      console.log("hcp.customer action: Auth failed, returning response");
      return authResult;
    }

    console.log("hcp.customer action: Creating service container");
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

    console.log("hcp.customer action: Parsing form data");
    console.log(
      "hcp.customer action: Request headers:",
      Object.fromEntries(request.headers.entries()),
    );
    console.log(
      "hcp.customer action: Request content-type:",
      request.headers.get("content-type"),
    );

    let formData;
    try {
      formData = await request.formData();
      console.log("hcp.customer action: Form data parsed successfully");
      console.log(
        "hcp.customer action: Form data entries:",
        Array.from(formData.entries()),
      );
    } catch (parseError) {
      console.error(
        "hcp.customer action: Failed to parse form data:",
        parseError,
      );
      console.error("hcp.customer action: Parse error details:", {
        name: parseError.name,
        message: parseError.message,
        stack: parseError.stack,
      });
      throw parseError;
    }

    console.log("hcp.customer action: Validating form data");
    const validated = CustomerValidator.validateFormData(formData);
    console.log("hcp.customer action: Validation result:", validated);

    console.log("hcp.customer action: Creating customer DTO");
    const customerDto = createCustomerDTO(validated);
    console.log("hcp.customer action: Customer DTO:", customerDto);

    console.log("hcp.customer action: Creating customer");
    const result = await CustomerService.createCustomer(customerDto);
    console.log("hcp.customer action: Customer creation result:", result);

    return jsonResponse(result);
  } catch (error) {
    console.error("hcp.customer action: Caught error:", error);
    console.error("hcp.customer action: Error name:", error.name);
    console.error("hcp.customer action: Error message:", error.message);
    console.error("hcp.customer action: Error stack:", error.stack);

    // Log additional error details
    if (error instanceof Error) {
      console.error("hcp.customer action: Error is instance of Error");
      console.error(
        "hcp.customer action: Error constructor:",
        error.constructor.name,
      );
    }

    if (error instanceof ValidationError) {
      console.log("hcp.customer action: Validation error, returning 400");
      return jsonResponse({ errors: error.errors }, error.statusCode);
    }

    if (error instanceof CustomerCreationError) {
      console.log("hcp.customer action: Customer creation error");
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
      console.log("hcp.customer action: GraphQL error");
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

    console.error("hcp.customer action: Unexpected error, returning 500");
    return jsonResponse(
      {
        error: "Internal server error",
        message: error.message || "Unknown error occurred",
      },
      500,
    );
  }
};
