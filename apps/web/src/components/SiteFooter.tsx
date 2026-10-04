import Link from "next/link";

import { BrandLogo } from "@/components/BrandLogo";
import { caretakerHref } from "@/components/HeaderAuthLinks";

const EXPLORE = [
  { href: "/wiedza", label: "Zasobnik wiedzy" },
  { href: "/kreator", label: "Kreator pomysłów" },
  { href: "/tester", label: "Tester innowacji" },
  { href: "/kontakt", label: "Kontakt" },
];

type SiteFooterProps = {
  loggedIn: boolean;
};

/**
 * Stopka MaloHUB — to samo tło co header, ciemny tekst (`--text`, 7.5:1).
 * Bez „Zaloguj się” — logowanie jest w headerze.
 */
export function SiteFooter({ loggedIn }: SiteFooterProps) {
  const start = loggedIn
    ? [
        { href: caretakerHref(true), label: "Zapytaj interaktywnego asystenta" },
        { href: "/app", label: "Twoja przestrzeń" },
        { href: "/profil", label: "Profil" },
      ]
    : [
        { href: caretakerHref(false), label: "Porozmawiaj z interaktywnym asystentem" },
        { href: "/#jak-to-dziala", label: "Jak to działa" },
        { href: "/register", label: "Załóż konto" },
      ];

  return (
    <footer className="site-footer">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-12 sm:px-10 md:grid-cols-[1.5fr_1fr_1fr]">
        <div className="max-w-sm">
          <BrandLogo size="md" />
          <p className="site-footer-muted mt-4 text-sm leading-6">
            Zgłaszaj problemy, wydarzenia i pomysły do właściwych jednostek. Interaktywny
            asystent pomoże dobrać rozwiązanie albo przekaże potrzebę dalej.
          </p>
        </div>

        <nav aria-labelledby="stopka-odkrywaj">
          <h2 id="stopka-odkrywaj" className="site-footer-heading">
            Odkrywaj
          </h2>
          <ul className="mt-4 space-y-2.5">
            {EXPLORE.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="site-footer-link">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-labelledby="stopka-start">
          <h2 id="stopka-start" className="site-footer-heading">
            Na start
          </h2>
          <ul className="mt-4 space-y-2.5">
            {start.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="site-footer-link">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="site-footer-bottom">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-6 py-5 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-10">
          <p>© {new Date().getFullYear()} MaloHUB</p>
          <p className="site-footer-muted">Twoja sprawa ma znaczenie.</p>
        </div>
      </div>
    </footer>
  );
}
