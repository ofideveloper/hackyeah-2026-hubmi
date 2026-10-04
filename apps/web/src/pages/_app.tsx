import type { AppProps } from "next/app";
import { Manrope, Sora } from "next/font/google";
import { useEffect } from "react";

import { AuthProvider } from "@/hooks/useAuth";
import "@/styles/globals.css";

const body = Manrope({
  variable: "--font-body",
  subsets: ["latin", "latin-ext"],
});

const display = Sora({
  variable: "--font-display",
  subsets: ["latin", "latin-ext"],
});

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

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    registerServiceWorker();
  }, []);

  return (
    <div className={`${body.variable} ${display.variable}`}>
      <a href="#tresc" className="skip-link">
        Przejdź do treści
      </a>
      <AuthProvider>
        <Component {...pageProps} />
      </AuthProvider>
    </div>
  );
}
