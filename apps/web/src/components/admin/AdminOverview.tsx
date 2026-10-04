import Link from "next/link";
import { useEffect, useState } from "react";

import { fetchAdminInbox, fetchAdminStats, type AdminInbox, type AdminStats } from "@/lib/api";
import { hasSessionHint } from "@/lib/auth";

const WAITING: { key: keyof AdminInbox; href: string; label: string }[] = [
  { key: "ideas", href: "/admin/ideas", label: "Nowe fiszki pomysłów" },
  { key: "messages", href: "/admin/messages", label: "Pytania bez odpowiedzi" },
  { key: "tester_signups", href: "/admin/testing", label: "Zgłoszenia testerów" },
  { key: "proposals", href: "/admin/proposals", label: "Propozycje z czatu" },
];

const LINKS = [
  { href: "/admin/catalog", label: "Katalog innowacji", hint: "Przegląd innowacji z bazy" },
  { href: "/admin/middleman", label: "Middleman Innowacji", hint: "Karta usługi dla instytucji" },
  { href: "/admin/proposals", label: "Propozycje", hint: "Potrzeby z czatu bez odpowiedzi w bazie" },
  { href: "/admin/knowledge", label: "Zasobnik wiedzy", hint: "Raporty, materiały, biblioteka" },
  { href: "/admin/ideas", label: "Fiszki pomysłów", hint: "Decyzja i komentarz dla autora" },
  { href: "/admin/grants", label: "Nabory grantowe", hint: "Pytania wniosku, złożone wnioski" },
  { href: "/admin/testing", label: "Zgłoszenia testerów", hint: "Przyjmij / odrzuć testerów, opinie" },
  { href: "/admin/messages", label: "Wiadomości", hint: "Pytania do zespołu ROPS" },
  { href: "/admin/trends", label: "Trendy potrzeb", hint: "Potrzeby według obszarów" },
  { href: "/admin/users", label: "Użytkownicy", hint: "Konta i rola mentora" },
] as const;

export function AdminOverview() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [inbox, setInbox] = useState<AdminInbox | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasSessionHint()) return;
    fetchAdminInbox()
      .then(setInbox)
      .catch(() => {
        // błąd pokaże pobieranie statystyk poniżej
      });
    fetchAdminStats()
      .then(setStats)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Nie udało się pobrać statystyk"),
      );
  }, []);

  return (
    <div className="space-y-8">
      {error && (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      )}

      <section aria-labelledby="czeka-h">
        <h2 id="czeka-h" className="text-base font-semibold">
          Czeka na Twoją decyzję
        </h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {WAITING.map((item) => {
            const count = inbox?.[item.key];
            return (
              <li key={item.key}>
                <Link
                  href={item.href}
                  className="admin-tile surface block p-5 transition-colors hover:bg-[var(--accent-soft)]"
                >
                  <p className="font-display text-2xl font-semibold tabular-nums">
                    {count == null ? "—" : count}
                  </p>
                  <p className="mt-1 text-sm text-[var(--muted)]">{item.label}</p>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="flex flex-wrap gap-x-10 gap-y-4 text-sm">
        <Stat label="Użytkownicy" value={stats?.users_total} />
      </section>

      <section>
        <h2 className="text-base font-semibold">Szybkie przejścia</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {LINKS.map((item) => (
            <li key={item.href}>
              <Link href={item.href} className="admin-tile surface block p-5 transition-colors hover:bg-[var(--accent-soft)]">
                <p className="font-medium">{item.label}</p>
                <p className="mt-1 text-sm text-[var(--muted)]">{item.hint}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value?: number }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-[var(--muted)]">{label}</p>
      <p className="font-display mt-1 text-2xl font-semibold tabular-nums">
        {value == null ? "—" : value}
      </p>
    </div>
  );
}
