/**
 * Minimal adapter for existing Vercel-style API handlers.
 * Keeps the current API implementations reusable while migrating routing to
 * Cloudflare Pages Functions. This is deliberately limited to the methods
 * used by the project's handlers.
 */
type LegacyHandler = (req: any, res: any) => unknown | Promise<unknown>;

export function adaptVercelHandler(handler: LegacyHandler) {
  return async ({ request }: { request: Request }): Promise<Response> => {
    const url = new URL(request.url);
    const headers = new Headers();
    let statusCode = 200;
    let response: Response | undefined;

    const res = {
      setHeader(name: string, value: string) {
        headers.set(name, value);
        return res;
      },
      status(code: number) {
        statusCode = code;
        return res;
      },
      json(data: unknown) {
        headers.set('Content-Type', 'application/json; charset=utf-8');
        response = new Response(JSON.stringify(data), {
          status: statusCode,
          headers
        });
        return response;
      },
      end() {
        response = new Response(null, { status: statusCode, headers });
        return response;
      }
    };

    const req = {
      method: request.method,
      query: Object.fromEntries(url.searchParams.entries()),
      headers: Object.fromEntries(request.headers.entries())
    };

    try {
      const returned = await handler(req, res);
      if (returned instanceof Response) return returned;
      if (response) return response;
      return new Response(JSON.stringify({ error: 'API handler returned no response' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      });
    } catch {
      return new Response(JSON.stringify({ error: 'Internal API error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      });
    }
  };
}
