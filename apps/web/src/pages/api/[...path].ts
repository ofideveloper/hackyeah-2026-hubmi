import type { NextApiRequest, NextApiResponse } from "next";

import { forwardToApi } from "@/lib/server/proxy";
import {
  clearSessionCookies,
  getSessionToken,
  isSafeMethod,
  isSameOriginRequest,
} from "@/lib/server/session";

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isSafeMethod(req.method ?? "GET") && !isSameOriginRequest(req)) {
    res.status(403).json({ detail: "Cross-origin request rejected" });
    return;
  }

  const pathParts = req.query.path;
  const path = Array.isArray(pathParts) ? pathParts.join("/") : (pathParts ?? "");
  const token = getSessionToken(req);

  try {
    const upstream = await forwardToApi(req, path, token);
    if (!upstream) {
      res.status(400).json({ detail: "Invalid API path" });
      return;
    }

    // 401 z FastAPI = token wygasł lub jest nieważny — nie trzymaj martwej sesji
    if (upstream.status === 401 && token) {
      clearSessionCookies(res);
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
