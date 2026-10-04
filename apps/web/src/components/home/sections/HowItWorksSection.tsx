import { DarkCtaBox, DarkCtaLinkCard } from "@/components/boxes";

const steps = [
  {
    number: "01",
    title: "Napisz do interaktywnego asystenta",
    description:
      "Opisz sprawę własnymi słowami — nawet bez konta. Interaktywny asystent podpowie sensowny kierunek.",
  },
  {
    number: "02",
    title: "Dobierzemy ścieżkę",
    description:
      "Gdy temat jest jasny, wskażemy sprawdzoną innowację albo przekażemy potrzebę zespołowi ROPS.",
  },
  {
    number: "03",
    title: "Działaj dalej",
    description:
      "Po założeniu konta zgłosisz własny pomysł, przetestujesz rozwiązanie i napiszesz do ROPS.",
  },
];

const destinations = [
  {
    href: "/wiedza",
    title: "Zasobnik wiedzy",
    description: "Wyzwania, innowacje i materiały edukacyjne.",
  },
  {
    href: "/kreator",
    title: "Kreator pomysłów",
    description: "Fiszka innowacji i wniosek grantowy.",
  },
  {
    href: "/tester",
    title: "Tester innowacji",
    description: "Testuj rozwiązania i zostaw opinię.",
  },
  {
    href: "/kontakt",
    title: "Kontakt",
    description: "Pytania do ROPS, mentorzy oraz współpraca międzysektorowa.",
  },
];

export type HowItWorksSectionProps = {
  loggedIn: boolean;
};

export function HowItWorksSection({ loggedIn }: HowItWorksSectionProps) {
  return (
    <section
      id="jak-to-dziala"
      className="border-y border-[var(--border)] bg-white/65"
    >
      <div className="mx-auto max-w-7xl px-6 py-16 sm:px-10 sm:py-20">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--accent-text)]">
            Jak to działa
          </p>
          <h2 className="font-display mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Mniej szukania. Więcej działania.
          </h2>
          <p className="mt-4 leading-7 text-[var(--muted)]">
            MaloHUB pomaga przejść od zauważonej potrzeby do sprawdzonego
            rozwiązania w kilku prostych krokach.
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {steps.map((step) => (
            <article
              key={step.number}
              className="rounded-2xl border border-[var(--border)] bg-white p-5 sm:p-6"
            >
              <p className="font-display text-sm font-semibold text-[var(--accent-text)]">
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
          <DarkCtaBox
            className="mt-10"
            title="Co chcesz zrobić dalej?"
            description="Wybierz obszar albo wróć do rozmowy z interaktywnym asystentem."
            action={{
              href: "/app#opiekun",
              label: "Zapytaj interaktywnego asystenta",
            }}
          >
            <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {destinations.map((item) => (
                <li key={item.href}>
                  <DarkCtaLinkCard
                    href={item.href}
                    title={item.title}
                    description={item.description}
                  />
                </li>
              ))}
            </ul>
          </DarkCtaBox>
        ) : (
          <DarkCtaBox
            className="mt-10"
            title="Masz sprawę do zgłoszenia?"
            description="Załóż konto i opisz ją we właściwym miejscu."
            action={{ href: "/register", label: "Załóż konto" }}
          />
        )}
      </div>
    </section>
  );
}
