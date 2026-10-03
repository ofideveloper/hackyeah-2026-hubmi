import type { NextApiRequest, NextApiResponse } from "next";

export const config = {
  api: {
    bodyParser: false,
  },
};

function getApiBaseUrl(): string {
  const base = process.env.API_URL ?? "http://localhost:8000";
  return base.endsWith("/") ? base : `${base}/`;
}

async function readRawBody(req: NextApiRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const pathParts = req.query.path;
  const path = Array.isArray(pathParts) ? pathParts.join("/") : (pathParts ?? "");

  const target = new URL(path, getApiBaseUrl());
  const incoming = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  incoming.searchParams.delete("path");
  target.search = incoming.search;

  const headers = new Headers();
  const authorization = req.headers.authorization;
  if (authorization) {
    headers.set("authorization", authorization);
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
  const body =
    rawBody && rawBody.length > 0 ? new Uint8Array(rawBody) : undefined;

  try {
    // manual — FastAPI 307 (/chat → /chat/) przy follow potrafi zepsuć POST body w Node fetch
    let upstream = await fetch(target, {
      method,
      headers,
      body,
      redirect: "manual",
    });

    if (upstream.status >= 300 && upstream.status < 400) {
      const location = upstream.headers.get("location");
      if (location) {
        upstream = await fetch(location, { method, headers, body, redirect: "manual" });
      }
    }

    res.status(upstream.status);
    const upstreamContentType = upstream.headers.get("content-type");
    if (upstreamContentType) {
      res.setHeader("content-type", upstreamContentType);
    }

    const data = Buffer.from(await upstream.arrayBuffer());
    res.send(data);
  } catch {
    res.status(502).json({ detail: "API upstream unavailable" });
  }
}
