import type { NextApiRequest, NextApiResponse } from "next";

import { clearSessionCookies, isSameOriginRequest } from "@/lib/server/session";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ detail: "Method not allowed" });
    return;
  }
  if (!isSameOriginRequest(req)) {
    res.status(403).json({ detail: "Cross-origin request rejected" });
    return;
  }

  clearSessionCookies(res);
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ ok: true });
}
