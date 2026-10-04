/** Znacznik „jest sesja” czytelny dla JS. Sam JWT siedzi w cookie HttpOnly ustawianym przez BFF. */
export const SESSION_HINT_COOKIE = "hubmi_auth";

const LEGACY_TOKEN_KEY = "hubmi_token";
/** Hint odświeżany po udanym `/auth/me` — nie musi równać się `exp` JWT. */
const HINT_MAX_AGE_SECONDS = 60 * 60 * 12;

export function hasSessionHint(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.split("; ").some((entry) => entry.startsWith(`${SESSION_HINT_COOKIE}=`));
}

/** Przywraca jawny znacznik po udanym bootstrapie (np. gdy wcześniej zniknął przy błędzie sieci). */
export function markSessionHint(): void {
  if (typeof document === "undefined") return;
  const secure = typeof window !== "undefined" && window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${SESSION_HINT_COOKIE}=1; Path=/; Max-Age=${HINT_MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
}

export function clearSessionHint(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${SESSION_HINT_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}

/** Sprzątanie po starszej wersji, która trzymała JWT w localStorage. */
export function dropLegacyToken(): void {
  try {
    localStorage.removeItem(LEGACY_TOKEN_KEY);
  } catch {
    // storage niedostępny (np. tryb prywatny) — nie ma czego sprzątać
  }
}
