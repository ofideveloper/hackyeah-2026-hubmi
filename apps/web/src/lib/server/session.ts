import type { NextApiRequest, NextApiResponse } from "next";

import { SESSION_HINT_COOKIE } from "@/lib/auth";

/** JWT z FastAPI — HttpOnly, niewidoczny dla JS w przeglądarce. */
export const SESSION_COOKIE = "hubmi_session";
const FALLBACK_MAX_AGE_SECONDS = 60 * 60;

/** Odczyt tokena z nagłówka `Cookie` (SSR / getInitialProps — bez NextApiRequest). */
export function readSessionTokenFromCookieHeader(
  cookieHeader: string | undefined,
): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    if (!trimmed.startsWith(`${SESSION_COOKIE}=`)) continue;
    const raw = trimmed.slice(SESSION_COOKIE.length + 1);
    try {
      return decodeURIComponent(raw) || null;
    } catch {
      return raw || null;
    }
  }
  return null;
}

function serializeCookie(name: string, value: string, maxAge: number, httpOnly: boolean): string {
  const parts = [`${name}=${encodeURIComponent(value)}`, "Path=/", `Max-Age=${maxAge}`, "SameSite=Lax"];
  if (httpOnly) parts.push("HttpOnly");
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  return parts.join("; ");
}

/** Czas życia cookie = `exp` z JWT (bez weryfikacji podpisu — tę robi FastAPI). */
function secondsUntilExpiry(token: string): number {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString()) as {
      exp?: unknown;
    };
    if (typeof payload.exp === "number") {
      return Math.max(0, Math.floor(payload.exp - Date.now() / 1000));
    }
  } catch {
    // nieczytelny payload — użyj wartości domyślnej
  }
  return FALLBACK_MAX_AGE_SECONDS;
}

export function getSessionToken(req: NextApiRequest): string | null {
  return req.cookies[SESSION_COOKIE] || null;
}

export function setSessionCookies(res: NextApiResponse, token: string): void {
  const maxAge = secondsUntilExpiry(token);
  res.setHeader("Set-Cookie", [
    serializeCookie(SESSION_COOKIE, token, maxAge, true),
    serializeCookie(SESSION_HINT_COOKIE, "1", maxAge, false),
  ]);
}

export function clearSessionCookies(res: NextApiResponse): void {
  res.setHeader("Set-Cookie", [
    serializeCookie(SESSION_COOKIE, "", 0, true),
    serializeCookie(SESSION_HINT_COOKIE, "", 0, false),
  ]);
}

/**
 * Ochrona CSRF dla żądań z cookie: przeglądarka musi potwierdzić, że żądanie
 * pochodzi z naszego originu (`Sec-Fetch-Site`, a w starszych — `Origin`).
 */
export function isSameOriginRequest(req: NextApiRequest): boolean {
  const fetchSite = req.headers["sec-fetch-site"];
  if (typeof fetchSite === "string") {
    return fetchSite === "same-origin";
  }
  const origin = req.headers.origin;
  if (!origin) return false;
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

export function isSafeMethod(method: string): boolean {
  return method === "GET" || method === "HEAD" || method === "OPTIONS";
}
