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
    console.log("authenticateAppProxy: Auth context keys:", Object.keys(context));
    console.log("authenticateAppProxy: Has session?:", !!context.session);
    console.log("authenticateAppProxy: Has admin?:", !!context.admin);

    if (!context.session?.shop) {
      console.error("authenticateAppProxy: No shop in session");
      return jsonResponse(
        {
          error: "Authentication failed - no shop in session",
        },
        401,
      );
    }

    if (!context.admin) {
      console.error("authenticateAppProxy: No admin in context");
      return jsonResponse(
        {
          error: "Authentication failed - no admin context",
        },
        401,
      );
    }

    const shop = context.session.shop;
    console.log("authenticateAppProxy: Auth successful for shop:", shop);
    
    return {
      shop,
      admin: context.admin,
    };
  } catch (sessionError) {
    console.error("authenticateAppProxy: Failed:", sessionError);
    console.error("authenticateAppProxy: Error name:", sessionError.name);
    console.error("authenticateAppProxy: Error message:", sessionError.message);
    
    return jsonResponse(
      {
        error: `Authentication failed: ${sessionError.message}`,
      },
      401,
    );
  }
}
