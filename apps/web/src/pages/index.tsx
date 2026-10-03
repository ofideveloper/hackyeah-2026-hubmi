import Head from "next/head";
import Link from "next/link";

import { AssistantChat } from "@/components/AssistantChat";

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

export default function HomePage() {
  return (
    <>
      <Head>
        <title>MaloHUB — Twoja sprawa ma znaczenie</title>
        <meta
          name="description"
          content="Zgłaszaj problemy, wydarzenia i informacje do właściwych jednostek. Prosto, lokalnie i w jednym miejscu."
        />
      </Head>

      <div className="min-h-screen overflow-hidden">
        <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 sm:px-10">
          <Link
            href="/"
            className="font-display flex items-center gap-2 text-xl font-semibold tracking-tight"
            aria-label="MaloHUB — strona główna"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent)] text-sm font-bold text-white">
              H
            </span>
            MaloHUB
          </Link>
          <nav className="flex items-center gap-3" aria-label="Nawigacja główna">
            <Link
              href="/wiedza"
              className="rounded-lg px-3 py-2 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--accent-soft)]"
            >
              Zasobnik wiedzy
            </Link>
            <Link
              href="/kreator"
              className="rounded-lg px-3 py-2 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--accent-soft)]"
            >
              Kreator pomysłów
            </Link>
            <Link
              href="/tester"
              className="rounded-lg px-3 py-2 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--accent-soft)]"
            >
              Tester innowacji
            </Link>
            <Link
              href="/kontakt"
              className="rounded-lg px-3 py-2 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--accent-soft)]"
            >
              Kontakt
            </Link>
            <Link
              href="/login"
              className="rounded-lg px-3 py-2 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--accent-soft)]"
            >
              Zaloguj się
            </Link>
            <Link href="/register" className="btn-primary px-4 py-2.5">
              Załóż konto
            </Link>
          </nav>
        </header>

        <main>
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
                Problem, wydarzenie, pomysł? Znajdź jednostkę, która odpowiada za
                Twój teren, i przekaż jej sprawę bez szukania właściwego kontaktu.
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
              <p className="mt-4 text-sm text-[var(--muted)]">
                Możesz zacząć bez logowania — konto przyda się później.
              </p>
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
                <AssistantChat guestMode />
                <p className="mt-3 text-center text-sm text-[var(--muted)]">
                  Chcesz przekazać sprawę dalej?{" "}
                  <Link
                    href="/register"
                    className="font-medium text-[var(--accent)] hover:underline"
                  >
                    Załóż konto
                  </Link>{" "}
                  albo{" "}
                  <Link
                    href="/login"
                    className="font-medium text-[var(--accent)] hover:underline"
                  >
                    zaloguj się
                  </Link>
                  .
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
            </div>
          </section>
        </main>

        <footer className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-7 text-sm text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between sm:px-10">
          <Link href="/" className="font-display font-semibold text-[var(--text)]">
            MaloHUB
          </Link>
          <p>Twoja sprawa ma znaczenie.</p>
          <Link href="/login" className="transition hover:text-[var(--accent)]">
            Zaloguj się
          </Link>
        </footer>
      </div>
    </>
  );
}
