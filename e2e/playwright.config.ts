import path from "node:path";

import { defineConfig, devices } from "@playwright/test";

import { ADMIN, API_PORT, BASE_URL, INSTANCE, LLM_PORT, WEB_PORT } from "./env";

const repoRoot = path.resolve(__dirname, "..");
const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "./tests",
  outputDir: "./test-results",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 2 : undefined,
  reporter: isCI
    ? [["github"], ["html", { outputFolder: "playwright-report", open: "never" }]]
    : [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: {
    baseURL: BASE_URL,
    locale: "pl-PL",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    // PWA: na telefonie nawigacja siedzi w szufladzie — wystarczy smoke.
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] }, testMatch: /smoke\.spec\.ts/ },
  ],
  webServer: [
    {
      command: `node llm-stub.mjs ${LLM_PORT}`,
      cwd: __dirname,
      url: `http://127.0.0.1:${LLM_PORT}/health`,
      reuseExistingServer: false,
    },
    {
      // Osobna baza, kasowana przy każdym starcie — dev-owa `hubmi.db` zostaje nietknięta.
      command: `rm -f data/e2e${INSTANCE}.db && .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port ${API_PORT}`,
      cwd: path.join(repoRoot, "apps/api"),
      url: `http://127.0.0.1:${API_PORT}/health`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        DATABASE_URL: `sqlite:///./data/e2e${INSTANCE}.db`,
        SECRET_KEY: "e2e-secret-not-for-production",
        ADMIN_EMAIL: ADMIN.email,
        ADMIN_PASSWORD: ADMIN.password,
        ADMIN_FULL_NAME: "Ada Admin",
        // Czat i asystent wołają model po HTTP — kierujemy je na lokalną atrapę.
        LLM_PROVIDER: "openai",
        LLM_BASE_URL: `http://127.0.0.1:${LLM_PORT}`,
        LLM_API_KEY: "e2e",
        SCRAPE_ON_STARTUP: "false",
        // Martwe proxy — gdyby coś jednak sięgnęło do rops.krakow.pl, odpada natychmiast
        // i testy nie dotykają zewnętrznego serwisu.
        HTTPS_PROXY: "http://127.0.0.1:9",
        NO_PROXY: "127.0.0.1,localhost",
        LOG_LEVEL: "WARNING",
        // Limity chronią koszt LLM — tutaj model jest atrapą, a testy lecą równolegle.
        CHAT_RATE_GUEST: "100000",
        CHAT_RATE_USER: "100000",
        AI_RATE_USER: "100000",
      },
    },
    {
      // Build produkcyjny w osobnym katalogu — nie gryzie się z `.next` z `npm run dev`.
      command: `npx next build && npx next start -p ${WEB_PORT}`,
      cwd: path.join(repoRoot, "apps/web"),
      url: BASE_URL,
      reuseExistingServer: false,
      timeout: 240_000,
      env: {
        API_URL: `http://127.0.0.1:${API_PORT}`,
        NEXT_DIST_DIR: `.next-e2e${INSTANCE}`,
      },
    },
  ],
});
