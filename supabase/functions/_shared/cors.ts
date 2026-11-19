// Browsers (the web app) send a "preflight" OPTIONS request before calling a
// function from another site, and need these headers on every reply. Phones
// don't, which is why the APK worked while the web app saw "offline".
// Allowing any origin is safe here: these functions authenticate with the
// caller's sign-in token (Authorization header), never with browser cookies.
export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

export function withCors(handler: (req: Request) => Response | Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
    const res = await handler(req);
    const headers = new Headers(res.headers);
    for (const [k, v] of Object.entries(CORS_HEADERS)) headers.set(k, v);
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
  };
}
