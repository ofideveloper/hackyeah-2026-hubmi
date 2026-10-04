/**
 * Porty inne niż w `npm run dev` (3000/8000) — testy mogą lecieć obok środowiska dev.
 * `E2E_PORT_OFFSET=10` stawia drugi, niezależny zestaw (porty, baza, build), np. gdy
 * w tle działa `npm run test:e2e:ui`.
 */
const offset = Number(process.env.E2E_PORT_OFFSET ?? 0);
export const WEB_PORT = 3100 + offset;
export const API_PORT = 8100 + offset;
export const LLM_PORT = 8150 + offset;
/** Dopisek do nazwy bazy i katalogu buildu — równoległe zestawy nie nadpisują sobie plików. */
export const INSTANCE = offset ? `-${offset}` : "";
export const BASE_URL = `http://localhost:${WEB_PORT}`;

/** Konto zakładane przez seed API (`ADMIN_EMAIL` / `ADMIN_PASSWORD` w konfiguracji webServer). */
export const ADMIN = {
  email: "admin@e2e-malohub.dev",
  password: "e2e-admin-password",
  name: "Ada",
  surname: "Admin",
};
