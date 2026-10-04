import type { NextApiRequest, NextApiResponse } from "next";

import { forwardToApi } from "@/lib/server/proxy";
import { isSameOriginRequest, setSessionCookies } from "@/lib/server/session";

export const config = {
  api: {
    bodyParser: false,
  },
};

/** Logowanie: JWT z FastAPI trafia do cookie HttpOnly, nigdy do odpowiedzi dla przeglądarki. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ detail: "Method not allowed" });
    return;
  }
  if (!isSameOriginRequest(req)) {
    res.status(403).json({ detail: "Cross-origin request rejected" });
    return;
  }

  try {
    const upstream = await forwardToApi(req, "auth/login", null);
    if (!upstream) {
      res.status(502).json({ detail: "API upstream unavailable" });
      return;
    }

    if (!upstream.ok) {
      res.status(upstream.status);
      const upstreamContentType = upstream.headers.get("content-type");
      if (upstreamContentType) {
        res.setHeader("content-type", upstreamContentType);
      }
      res.send(Buffer.from(await upstream.arrayBuffer()));
      return;
    }

    const data = (await upstream.json()) as { access_token?: unknown };
    if (typeof data.access_token !== "string" || !data.access_token) {
      res.status(502).json({ detail: "API upstream unavailable" });
      return;
    }

    setSessionCookies(res, data.access_token);
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({ ok: true });
  } catch {
    res.status(502).json({ detail: "API upstream unavailable" });
  }
}
