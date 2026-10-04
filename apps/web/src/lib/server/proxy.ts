import type { NextApiRequest } from "next";

function getApiBaseUrl(): URL {
  const base = process.env.API_URL ?? "http://localhost:8000";
  return new URL(base.endsWith("/") ? base : `${base}/`);
}

async function readRawBody(req: NextApiRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

/**
 * Przekazuje żądanie do wewnętrznego FastAPI. Token pochodzi wyłącznie z cookie
 * sesji (nagłówek `Authorization` z przeglądarki jest ignorowany).
 * Zwraca `null`, gdy ścieżka wskazuje poza API — token nie może trafić do obcego hosta.
 */
export async function forwardToApi(
  req: NextApiRequest,
  path: string,
  token: string | null,
): Promise<Response | null> {
  const base = getApiBaseUrl();
  const target = new URL(path, base);
  if (target.origin !== base.origin) {
    return null;
  }
  const incoming = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  incoming.searchParams.delete("path");
  target.search = incoming.search;

  const headers = new Headers();
  if (token) {
    headers.set("authorization", `Bearer ${token}`);
  }
  const contentType = req.headers["content-type"];
  if (contentType) {
    headers.set("content-type", contentType);
  }
  const accept = req.headers.accept;
  if (accept) {
    headers.set("accept", accept);
  }

  const method = req.method ?? "GET";
  const hasBody = method !== "GET" && method !== "HEAD";
  const rawBody = hasBody ? await readRawBody(req) : undefined;
  const body = rawBody && rawBody.length > 0 ? new Uint8Array(rawBody) : undefined;

  // manual — FastAPI 307 (/chat → /chat/) przy follow potrafi zepsuć POST body w Node fetch
  const upstream = await fetch(target, { method, headers, body, redirect: "manual" });

  if (upstream.status >= 300 && upstream.status < 400) {
    const location = upstream.headers.get("location");
    if (location) {
      const redirected = new URL(location, target);
      if (redirected.origin !== base.origin) {
        return null;
      }
      return fetch(redirected, { method, headers, body, redirect: "manual" });
    }
  }

  return upstream;
}
