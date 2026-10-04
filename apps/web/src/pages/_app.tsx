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
      <AuthProvider>
        <Component {...pageProps} />
      </AuthProvider>
    </div>
  );
}
