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

  try {
    const result = await unauthenticated.admin(shop);
    return {
      shop,
      admin: result.admin,
    };
  } catch (sessionError) {
    console.error("Failed to get admin session for shop:", shop, sessionError);
    return jsonResponse(
      {
        error: "Session not found",
        message: `No offline session found for shop: ${shop}. The app may need to be reinstalled.`,
      },
      401,
    );
  }
}
