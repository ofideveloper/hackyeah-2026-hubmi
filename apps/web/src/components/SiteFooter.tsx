import Link from "next/link";

/**
 * Wspólna stopka MaloHUB — LP, logowanie i rejestracja.
 */
export function SiteFooter() {
  return (
    <footer className="text-sm text-[var(--muted)]">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-12 sm:px-10 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="max-w-sm">
          <Link
            href="/"
            className="font-display flex items-center gap-2 text-lg font-semibold tracking-tight text-[var(--text)]"
            aria-label="MaloHUB — strona główna"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent)] text-xs font-bold text-white">
              H
            </span>
            MaloHUB
          </Link>
          <p className="mt-4 leading-6">
            Zgłaszaj problemy, wydarzenia i informacje do właściwych
            jednostek. Prosto, lokalnie i w jednym miejscu.
          </p>
        </div>

        <nav aria-label="Na stronie">
          <h2 className="font-semibold text-[var(--text)]">Na stronie</h2>
          <ul className="mt-4 space-y-2.5">
            <li>
              <Link href="/#opiekun" className="transition hover:text-[var(--accent)]">
                Porozmawiaj z opiekunem
              </Link>
            </li>
            <li>
              <Link href="/#jak-to-dziala" className="transition hover:text-[var(--accent)]">
                Jak to działa
              </Link>
            </li>
          </ul>
        </nav>

        <nav aria-label="Konto">
          <h2 className="font-semibold text-[var(--text)]">Konto</h2>
          <ul className="mt-4 space-y-2.5">
            <li>
              <Link href="/register" className="transition hover:text-[var(--accent)]">
                Załóż konto
              </Link>
            </li>
          </ul>
        </nav>
      </div>

      <div className="border-t border-[var(--border)]">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-10">
          <p>© {new Date().getFullYear()} MaloHUB</p>
          <p>Twoja sprawa ma znaczenie.</p>
        </div>
      </div>
    </footer>
  );
}
