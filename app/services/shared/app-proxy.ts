import { authenticate, unauthenticated } from "../../shopify.server";
import { jsonResponse } from "./api";

export interface AppProxyContext {
  shop: string;
  admin: {
    graphql: (
      query: string,
      options?: { variables?: Record<string, unknown> },
    ) => Promise<Response>;
  };
}

export async function authenticateAppProxy(
  request: Request,
): Promise<AppProxyContext | Response> {
  try {
    const context = await authenticate.public.appProxy(request);

    if (!context.session?.shop) {
      return jsonResponse(
        {
          error: "Authentication failed - no shop in session",
        },
        401,
      );
    }

    if (!context.admin) {
      return jsonResponse(
        {
          error: "Authentication failed - no admin context",
        },
        401,
      );
    }

    const shop = context.session.shop;

    return {
      shop,
      admin: context.admin,
    };
  } catch (sessionError) {
    return jsonResponse(
      {
        error: `Authentication failed: ${sessionError.message}`,
      },
      401,
    );
  }
}
