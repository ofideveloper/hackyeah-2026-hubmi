import Link from "next/link";
import type { ReactNode } from "react";

type SiteHeaderProps = {
  actions?: ReactNode;
  /** Szerokość kontenera — LP/app vs admin */
  wide?: boolean;
};

/**
 * Wspólny pasek nawigacji MaloHUB — ten sam układ na LP, auth i w aplikacji.
 */
export function SiteHeader({ actions, wide = false }: SiteHeaderProps) {
  return (
    <header className="site-header">
      <div
        className={`mx-auto flex w-full items-center justify-between gap-3 px-6 py-4 ${
          wide ? "max-w-5xl" : "max-w-3xl"
        }`}
      >
        <Link
          href="/"
          className="font-display text-sm font-semibold tracking-wide text-[var(--accent)] transition-opacity hover:opacity-80"
        >
          MaloHUB
        </Link>
        <nav className="flex flex-wrap items-center justify-end gap-2" aria-label="Główne">
          {actions}
        </nav>
      </div>
    </header>
  );
}

export function GuestHeaderActions() {
  return (
    <>
      <Link href="/login" className="btn-ghost">
        Zaloguj się
      </Link>
      <Link href="/register" className="btn-primary">
        Załóż konto
      </Link>
    </>
  );
}
