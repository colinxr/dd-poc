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
  console.log("authenticateAppProxy: Starting authentication");
  console.log("authenticateAppProxy: Request URL:", request.url);
  
  try {
    const context = await authenticate.public.appProxy(request);
    console.log("authenticateAppProxy: Auth context:", context);

    if (!context.session?.shop) {
      console.error("authenticateAppProxy: No shop in session");
      return jsonResponse(
        {
          error: "Authentication failed",
          message: "Unable to authenticate app proxy request - no shop in session",
        },
        401,
      );
    }

    const shop = context.session.shop;
    console.log("authenticateAppProxy: Shop found:", shop);

    console.log("authenticateAppProxy: Getting admin session");
    const result = await unauthenticated.admin(shop);
    console.log("authenticateAppProxy: Admin session created successfully");
    
    return {
      shop,
      admin: result.admin,
    };
  } catch (sessionError) {
    console.error("authenticateAppProxy: Failed to get admin session:", sessionError);
    console.error("authenticateAppProxy: Error details:", {
      name: sessionError.name,
      message: sessionError.message,
      stack: sessionError.stack
    });
    
    return jsonResponse(
      {
        error: "Session not found",
        message: `No offline session found for shop. The app may need to be reinstalled.`,
      },
      401,
    );
  }
}
