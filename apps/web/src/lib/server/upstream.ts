/**
 * Wywołania FastAPI z serwera Next (SSR / getServerSideProps).
 * Tylko `process.env.API_URL` — nigdy nie wystawiaj tego URL-a do klienta.
 */

function apiOrigin(): URL {
  const base = process.env.API_URL ?? "http://localhost:8000";
  return new URL(base.endsWith("/") ? base : `${base}/`);
}

/**
 * Publiczny GET do wewnętrznego API. Zwraca `null` przy błędzie sieci / nie-2xx
 * (strona może wtedy dociągnąć dane po stronie klienta).
 */
export async function fetchUpstreamJson<T>(path: string): Promise<T | null> {
  const target = new URL(path.replace(/^\//, ""), apiOrigin());
  if (target.origin !== apiOrigin().origin) {
    return null;
  }

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
