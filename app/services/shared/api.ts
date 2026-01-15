export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/**
 * Helper to return a JSON response with CORS headers.
 * Automatically stringifies the data and sets Content-Type: application/json.
 */
export function jsonResponse(data: unknown, init: ResponseInit | number = {}) {
  let responseInit: ResponseInit;

  if (typeof init === "number") {
    responseInit = { status: init };
  } else {
    responseInit = init;
  }

  const headers = new Headers(responseInit.headers);

  // Apply CORS headers
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    headers.set(key, value);
  }

  return Response.json(data, {
    ...responseInit,
    headers,
  });
}
