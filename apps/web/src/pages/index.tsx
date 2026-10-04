import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

import { AssistantChat } from "@/components/AssistantChat";
import { HowItWorksSection } from "@/components/home/sections";
import { SiteFooter } from "@/components/SiteFooter";
import { AppNav, SiteHeader } from "@/components/SiteHeader";
import { useAuth } from "@/hooks/useAuth";

function isOpiekunHash(asPath: string): boolean {
  const hash = asPath.includes("#")
    ? asPath.slice(asPath.indexOf("#") + 1)
    : typeof window !== "undefined"
      ? window.location.hash.replace(/^#/, "")
      : "";
  return hash === "opiekun";
}

export default function HomePage() {
  const router = useRouter();
  const { user, isLoggedIn } = useAuth();
  const [focusChat, setFocusChat] = useState(false);
  const loggedIn = isLoggedIn;
  const userName = user
    ? user.full_name || `${user.name} ${user.surname}`.trim()
    : null;

  useEffect(() => {
    if (!router.isReady) return;

    const activate = () => {
      if (!isOpiekunHash(router.asPath)) {
        setFocusChat(false);
        return;
      }
      document
        .getElementById("opiekun")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      setFocusChat(true);
    };

    activate();
    window.addEventListener("hashchange", activate);
    return () => window.removeEventListener("hashchange", activate);
  }, [router.isReady, router.asPath]);

  return (
    <>
      <Head>
        <title>MaloHUB — Twoja sprawa ma znaczenie</title>
        <meta
          name="description"
          content="Opisz sprawę interaktywnemu asystentowi, przeglądaj wiedzę i innowacje społeczne. Prosto i w jednym miejscu."
        />
      </Head>

      <div className="min-h-screen overflow-hidden">
        <SiteHeader width="full" logoSize="lg" actions={<AppNav />} />

        <main id="tresc" tabIndex={-1}>
          <section className="mx-auto grid max-w-7xl items-center gap-12 px-6 pb-20 pt-12 sm:px-10 sm:pb-28 sm:pt-20 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
            <div>
              <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white/80 px-3.5 py-2 text-sm font-medium text-[var(--muted)] shadow-sm">
                <span className="h-2 w-2 rounded-full bg-[var(--accent)]" />
                Twoja sprawa w jednym miejscu
              </p>
              <h1 className="font-display max-w-2xl text-4xl font-semibold leading-[1.1] tracking-tight text-[var(--text)] sm:text-5xl lg:text-6xl">
                Opisz problem. Dopasujemy{" "}
                <span className="text-[var(--accent-text)]">sprawdzone</span>{" "}
                rozwiązanie.
              </h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-[var(--muted)] sm:text-lg sm:leading-8">
                Interaktywny asystent Małopolskiego Hubu Innowacji Społecznych połączy Twoje
                zgłoszenie z podobnymi sprawami i gotowymi innowacjami. Możesz
                też zgłosić własny pomysł, wziąć udział w testach albo zapytać
                zespół ROPS i mentorów.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <a
                  href="#opiekun"
                  className="btn-primary gap-2 px-5 py-3 text-base"
                >
                  Porozmawiaj z interaktywnym asystentem
                  <span aria-hidden="true">→</span>
                </a>
                <Link
                  href="/wiedza"
                  className="btn-ghost px-5 py-3 text-base font-extrabold"
                >
                  Zasobnik wiedzy
                </Link>
              </div>
              {!loggedIn && (
                <p className="mt-4 text-sm text-[var(--muted)]">
                  Rozmowę możesz zacząć od razu —{" "}
                  <Link
                    href="/login"
                    className="font-medium text-[var(--text)] underline decoration-[var(--border)] underline-offset-2 transition hover:text-[var(--accent-hover)] hover:decoration-[var(--accent)]"
                  >
                    konto
                  </Link>{" "}
                  pozwoli później śledzić sprawę.
                </p>
              )}
            </div>

            <div
              id="opiekun"
              className="relative mx-auto w-full max-w-xl lg:ml-auto"
            >
              <div
                aria-hidden="true"
                className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[var(--accent-soft)] blur-3xl"
              />
              <div className="relative">
                <AssistantChat
                  guestMode={!loggedIn}
                  userName={userName}
                  autoFocus={focusChat}
                />
                <p className="mt-3 text-center text-sm text-[var(--muted)]">
                  {loggedIn ? (
                    <>
                      Wygodniej porozmawiasz w{" "}
                      <Link
                        href="/app"
                        className="font-medium text-[var(--accent-text)] underline underline-offset-2"
                      >
                        Twojej przestrzeni
                      </Link>
                      .
                    </>
                  ) : (
                    <>
                      Chcesz przekazać sprawę dalej?{" "}
                      <Link
                        href="/register"
                        className="font-medium text-[var(--accent-text)] underline underline-offset-2"
                      >
                        Załóż konto
                      </Link>{" "}
                      albo{" "}
                      <Link
                        href="/login"
                        className="font-medium text-[var(--accent-text)] underline underline-offset-2"
                      >
                        zaloguj się
                      </Link>
                      .
                    </>
                  )}
                </p>
              </div>
            </div>
          </section>

          <HowItWorksSection loggedIn={loggedIn} />
        </main>

        <SiteFooter loggedIn={loggedIn} />
      </div>
    </>
  );
}
