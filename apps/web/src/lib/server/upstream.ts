/**
 * Wywołania FastAPI z serwera Next (SSR / getInitialProps).
 * Tylko `process.env.API_URL` — nigdy nie wystawiaj tego URL-a do klienta.
 */

function apiOrigin(): URL {
  const base = process.env.API_URL ?? "http://localhost:8000";
  return new URL(base.endsWith("/") ? base : `${base}/`);
}

function resolveUpstream(path: string): URL | null {
  const target = new URL(path.replace(/^\//, ""), apiOrigin());
  if (target.origin !== apiOrigin().origin) return null;
  return target;
}

/**
 * Publiczny GET do wewnętrznego API. Zwraca `null` przy błędzie sieci / nie-2xx
 * (strona może wtedy dociągnąć dane po stronie klienta).
 */
export async function fetchUpstreamJson<T>(path: string): Promise<T | null> {
  const target = resolveUpstream(path);
  if (!target) return null;

  try {
    const res = await fetch(target, {
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/**
 * Autoryzowany GET (Bearer z cookie `hubmi_session`) — np. `/auth/me` w SSR.
 */
export async function fetchUpstreamAuthedJson<T>(
  path: string,
  token: string,
): Promise<T | null> {
  const target = resolveUpstream(path);
  if (!target) return null;

  try {
    const res = await fetch(target, {
      headers: {
        accept: "application/json",
        authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
