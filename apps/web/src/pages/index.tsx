import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

import { AssistantChat } from "@/components/AssistantChat";
import { AppNav, SiteHeader } from "@/components/SiteHeader";
import { useAuth } from "@/hooks/useAuth";

const steps = [
  {
    number: "01",
    title: "Napisz do opiekuna",
    description:
      "Opisz sprawę własnymi słowami — nawet bez konta. Opiekun podpowie sensowny kierunek.",
  },
  {
    number: "02",
    title: "Dobierzemy ścieżkę",
    description:
      "Gdy temat jest jasny, wskażemy pasujący projekt albo zbierzemy materiał dla jednostki.",
  },
  {
    number: "03",
    title: "Śledź postęp",
    description:
      "Po założeniu konta zobaczysz statusy spraw w swojej przestrzeni MaloHUB.",
  },
];

const destinations = [
  {
    href: "/wiedza",
    title: "Zasobnik wiedzy",
    description: "Wyzwania społeczne, biblioteka innowacji i materiały edukacyjne.",
  },
  {
    href: "/kreator",
    title: "Kreator pomysłów",
    description: "Opisz innowację, rozwiń fiszkę i złóż wniosek w naborze grantowym.",
  },
  {
    href: "/tester",
    title: "Tester innowacji",
    description: "Zgłoś się do testów rozwiązań i zostaw opinię z usprawnieniami.",
  },
  {
    href: "/kontakt",
    title: "Kontakt",
    description: "Pytania do ROPS, mentorzy oraz współpraca międzysektorowa.",
  },
  {
    href: "/app",
    title: "Zapytaj opiekuna",
    description: "Opisz sprawę i śledź statusy w swojej przestrzeni.",
  },
];

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
  const { status, user, token } = useAuth();
  const [focusChat, setFocusChat] = useState(false);
  const loggedIn = status === "authenticated" || (status === "loading" && Boolean(token));
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
          content="Opisz sprawę opiekunowi, przeglądaj wiedzę i innowacje społeczne. Prosto, lokalnie i w jednym miejscu."
        />
      </Head>

      <div className="min-h-screen overflow-hidden">
        <SiteHeader width="full" logoSize="lg" actions={<AppNav />} />

        <main id="tresc" tabIndex={-1}>
          <section className="mx-auto grid max-w-7xl items-center gap-12 px-6 pb-20 pt-12 sm:px-10 sm:pb-28 sm:pt-20 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
            <div className="animate-fade-up">
              <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white/80 px-3.5 py-2 text-sm font-medium text-[var(--muted)] shadow-sm">
                <span className="h-2 w-2 rounded-full bg-[var(--accent)]" />
                Sprawy Twojej okolicy w jednym miejscu
              </p>
              <h1 className="font-display max-w-2xl text-4xl font-semibold leading-[1.1] tracking-tight text-[var(--text)] sm:text-5xl lg:text-6xl">
                Zgłaszaj to, co{" "}
                <span className="text-[var(--accent)]">ważne</span> dla Twojej
                okolicy.
              </h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-[var(--muted)] sm:text-lg sm:leading-8">
                Problem, wydarzenie albo pomysł? Opisz go opiekunowi albo zajrzyj do
                zasobnika wiedzy i gotowych rozwiązań — bez zgadywania, od czego zacząć.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <a href="#opiekun" className="btn-primary gap-2 px-5 py-3 text-base">
                  Porozmawiaj z opiekunem
                  <span aria-hidden="true">→</span>
                </a>
                <Link href="/wiedza" className="btn-ghost px-5 py-3 text-base">
                  Zasobnik wiedzy
                </Link>
              </div>
              {!loggedIn && (
                <p className="mt-4 text-sm text-[var(--muted)]">
                  Możesz zacząć bez logowania — konto przyda się później.
                </p>
              )}
            </div>

            <div
              id="opiekun"
              className="animate-fade-up-delay relative mx-auto w-full max-w-xl lg:ml-auto"
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
                      Statusy spraw i pełna historia są w{" "}
                      <Link
                        href="/app"
                        className="font-medium text-[var(--accent)] underline underline-offset-2"
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
                        className="font-medium text-[var(--accent)] underline underline-offset-2"
                      >
                        Załóż konto
                      </Link>{" "}
                      albo{" "}
                      <Link
                        href="/login"
                        className="font-medium text-[var(--accent)] underline underline-offset-2"
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

          <section
            id="jak-to-dziala"
            className="border-y border-[var(--border)] bg-white/65"
          >
            <div className="mx-auto max-w-7xl px-6 py-16 sm:px-10 sm:py-20">
              <div className="max-w-2xl">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
                  Jak to działa
                </p>
                <h2 className="font-display mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                  Mniej szukania. Więcej działania.
                </h2>
                <p className="mt-4 leading-7 text-[var(--muted)]">
                  MaloHUB pomaga przejść od zauważonej sprawy do właściwej jednostki
                  w kilku prostych krokach.
                </p>
              </div>

              <div className="mt-10 grid gap-4 md:grid-cols-3">
                {steps.map((step) => (
                  <article
                    key={step.number}
                    className="rounded-2xl border border-[var(--border)] bg-white p-5 sm:p-6"
                  >
                    <p className="font-display text-sm font-semibold text-[var(--accent)]">
                      {step.number}
                    </p>
                    <h3 className="mt-5 text-lg font-semibold">{step.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                      {step.description}
                    </p>
                  </article>
                ))}
              </div>

              {loggedIn ? (
                <div className="mt-10 rounded-2xl bg-[var(--text)] px-6 py-7 text-white sm:px-8">
                  <div className="max-w-2xl">
                    <h2 className="font-display text-xl font-semibold">
                      Co chcesz zrobić dalej?
                    </h2>
                    <p className="mt-1.5 text-sm text-white/70">
                      Wybierz obszar — wiedza, pomysł, testy, kontakt albo rozmowa z opiekunem.
                    </p>
                  </div>
                  <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {destinations.map((item) => (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className="block h-full rounded-xl border border-white/15 bg-white/5 px-4 py-4 transition hover:bg-white/10"
                        >
                          <span className="font-semibold">{item.title}</span>
                          <span className="mt-1.5 block text-sm text-white/70">
                            {item.description}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="mt-10 flex flex-col justify-between gap-5 rounded-2xl bg-[var(--text)] px-6 py-7 text-white sm:flex-row sm:items-center sm:px-8">
                  <div>
                    <h2 className="font-display text-xl font-semibold">
                      Masz sprawę do zgłoszenia?
                    </h2>
                    <p className="mt-1.5 text-sm text-white/70">
                      Załóż konto i opisz ją we właściwym miejscu.
                    </p>
                  </div>
                  <Link
                    href="/register"
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-semibold text-[var(--text)] transition hover:bg-[var(--accent-soft)]"
                  >
                    Załóż konto
                    <span aria-hidden="true">→</span>
                  </Link>
                </div>
              )}
            </div>
          </section>
        </main>

        <footer className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-7 text-sm text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between sm:px-10">
          <Link href="/" className="font-display font-semibold text-[var(--text)]">
            MaloHUB
          </Link>
          <p>Twoja sprawa ma znaczenie.</p>
          {loggedIn ? (
            <Link href="/app" className="transition hover:text-[var(--accent)]">
              Zapytaj opiekuna
            </Link>
          ) : (
            <Link href="/login" className="transition hover:text-[var(--accent)]">
              Zaloguj się
            </Link>
          )}
        </footer>
      </div>
    </>
  );
}
