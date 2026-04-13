export interface Env {}

function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data, null, 2), {
    ...init,
    headers,
  });
}

export default {
  async fetch(request: Request, _env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/") {
      return json({
        name: "Ethos Aegis Worker",
        status: "ok",
        runtime: "cloudflare-workers",
        message: "Cloudflare Worker bootstrap is live.",
        endpoints: ["/", "/health", "/meta"],
      });
    }

    if (url.pathname === "/health") {
      return json({
        ok: true,
        service: "ethos-aegis-worker",
        timestamp: new Date().toISOString(),
      });
    }

    if (url.pathname === "/meta") {
      return json({
        project: "Ethos-Aegis-Agentic-Immune-Veriflow",
        deployment: "worker-bootstrap",
        purpose: "Minimal deployment entrypoint for future agentic surfaces",
      });
    }

    return json(
      {
        ok: false,
        error: "Not Found",
        path: url.pathname,
      },
      { status: 404 },
    );
  },
};
