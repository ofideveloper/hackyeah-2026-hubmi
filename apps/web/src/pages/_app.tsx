import type { AppProps } from "next/app";
import { Manrope, Sora } from "next/font/google";

import "@/styles/globals.css";

const body = Manrope({
  variable: "--font-body",
  subsets: ["latin", "latin-ext"],
});

const display = Sora({
  variable: "--font-display",
  subsets: ["latin", "latin-ext"],
});

export default function App({ Component, pageProps }: AppProps) {
  return (
    <div className={`${body.variable} ${display.variable}`}>
      <Component {...pageProps} />
    </div>
  );
}
