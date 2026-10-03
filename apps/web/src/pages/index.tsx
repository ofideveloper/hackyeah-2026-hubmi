import Head from "next/head";
import Link from "next/link";

const steps = [
  {
    number: "01",
    title: "Wybierz właściwą jednostkę",
    description:
      "Sprawdź, kto odpowiada za Twój teren i rodzaj sprawy. Wszystko znajdziesz w jednym miejscu.",
  },
  {
    number: "02",
    title: "Opisz, co się dzieje",
    description:
      "Zgłoś problem, wydarzenie albo ważną informację. Wystarczy krótki tytuł i kilka zdań.",
  },
  {
    number: "03",
    title: "Wróć do swoich zgłoszeń",
    description:
      "Zaloguj się, aby zobaczyć swoje zgłoszenia i projekty lokalnych jednostek.",
  },
];

export default function HomePage() {
  return (
    <>
      <Head>
        <title>HubMI — Twoja sprawa ma znaczenie</title>
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
            aria-label="HubMI — strona główna"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent)] text-sm font-bold text-white">
              H
            </span>
            HubMI
          </Link>
          <nav className="flex items-center gap-3" aria-label="Nawigacja główna">
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
                <Link href="/register" className="btn-primary gap-2 px-5 py-3 text-base">
                  Zacznij zgłaszać
                  <span aria-hidden="true">→</span>
                </Link>
                <Link href="/login" className="btn-ghost px-5 py-3 text-base">
                  Mam już konto
                </Link>
              </div>
              <p className="mt-4 text-sm text-[var(--muted)]">
                Założenie konta zajmuje tylko chwilę.
              </p>
            </div>

            <div className="animate-fade-up-delay relative mx-auto w-full max-w-xl lg:ml-auto">
              <div
                aria-hidden="true"
                className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[var(--accent-soft)] blur-3xl"
              />
              <div className="relative rounded-[1.75rem] border border-[var(--border)] bg-white p-4 shadow-[0_24px_80px_rgba(26,35,48,0.12)] sm:p-6">
                <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        fill="none"
                        className="h-5 w-5"
                      >
                        <path
                          d="M12 21s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12Z"
                          stroke="currentColor"
                          strokeWidth="1.8"
                        />
                        <circle
                          cx="12"
                          cy="9"
                          r="2.3"
                          stroke="currentColor"
                          strokeWidth="1.8"
                        />
                      </svg>
                    </span>
                    <div>
                      <p className="font-display text-sm font-semibold">Twoja okolica</p>
                      <p className="mt-0.5 text-xs text-[var(--muted)]">
                        Zgłoszenia i lokalne sprawy
                      </p>
                    </div>
                  </div>
                  <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--accent)]">
                    HubMI
                  </span>
                </div>

                <div className="py-5">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">Przykład zgłoszenia</p>
                    <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">
                      Problem
                    </span>
                  </div>
                  <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-4 sm:p-5">
                    <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                      Tytuł
                    </p>
                    <p className="mt-1.5 font-semibold leading-snug">
                      Nie działa oświetlenie na skwerze
                    </p>
                    <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                      Wybierasz jednostkę odpowiedzialną za dany teren i opisujesz,
                      czego dotyczy sprawa.
                    </p>
                  </div>
                  <div className="mt-4 flex items-start gap-3 rounded-xl border border-[var(--border)] p-3.5">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        fill="none"
                        className="h-4 w-4"
                      >
                        <path
                          d="M5 12h14M13 6l6 6-6 6"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                    <div>
                      <p className="text-sm font-semibold">Właściwy adresat</p>
                      <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                        Zakres terenu i kompetencje pomagają wybrać odpowiednią
                        jednostkę.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 border-t border-[var(--border)] pt-4 text-xs text-[var(--muted)]">
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    className="h-4 w-4 text-[var(--accent)]"
                  >
                    <path
                      d="m5 12 4 4L19 6"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Prosto, lokalnie i bez zgadywania, gdzie napisać
                </div>
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
                  HubMI pomaga przejść od zauważonej sprawy do właściwej jednostki
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
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-semibold text-[var(--text)] transition hover:bg-emerald-50"
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
            HubMI
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
