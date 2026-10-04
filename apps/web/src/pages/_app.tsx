import App, { type AppContext, type AppProps } from "next/app";
import { Manrope, Sora } from "next/font/google";
import { useEffect } from "react";

import { AuthProvider } from "@/hooks/useAuth";
import type { User } from "@/lib/api";
import "@/styles/globals.css";

const body = Manrope({
  variable: "--font-body",
  subsets: ["latin", "latin-ext"],
});

const display = Sora({
  variable: "--font-display",
  subsets: ["latin", "latin-ext"],
});

type MaloAppProps = AppProps & {
  /** User z cookie HttpOnly — tylko przy SSR (pierwszy HTML). */
  initialUser?: User | null;
};

function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  // W dev service worker tylko przeszkadza: trzyma stare chunki i maskuje zmiany w kodzie.
  if (process.env.NODE_ENV !== "production") {
    void navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => registrations.forEach((registration) => void registration.unregister()));
    if ("caches" in window) {
      void caches.keys().then((keys) => keys.forEach((key) => void caches.delete(key)));
    }
    return;
  }

  void navigator.serviceWorker.register("/sw.js").catch(() => {
    // cicho — brak SW nie blokuje appki
  });
}

export default function MaloApp({ Component, pageProps, initialUser = null }: MaloAppProps) {
  useEffect(() => {
    registerServiceWorker();
  }, []);

  return (
    <div className={`${body.variable} ${display.variable}`}>
      <a href="#tresc" className="skip-link">
        Przejdź do treści
      </a>
      <AuthProvider initialUser={initialUser}>
        <Component {...pageProps} />
      </AuthProvider>
    </div>
  );
}

/**
 * SSR: odczytaj JWT z cookie i dociągnij `/auth/me` zanim React wyrenderuje UI.
 * Na nawigacji klienckiej AuthProvider już trzyma cache — nie wołamy ponownie API.
 */
MaloApp.getInitialProps = async (appContext: AppContext) => {
  const appProps = await App.getInitialProps(appContext);

  // Client-side transitions: AuthProvider już trzyma cache — bez ponownego SSR.
  if (typeof window !== "undefined") {
    return { ...appProps, initialUser: null };
  }

  // Dynamic import — kod serwerowy nie trafia do bundla przeglądarki.
  const { readSessionTokenFromCookieHeader } = await import("@/lib/server/session");
  const { fetchUpstreamAuthedJson } = await import("@/lib/server/upstream");

  const token = readSessionTokenFromCookieHeader(appContext.ctx.req?.headers.cookie);
  const initialUser = token ? await fetchUpstreamAuthedJson<User>("auth/me", token) : null;

  return { ...appProps, initialUser };
};
