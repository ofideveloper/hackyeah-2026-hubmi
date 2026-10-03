import Link from "next/link";
import { useEffect, useState } from "react";

import { fetchAdminStats, type AdminStats } from "@/lib/api";
import { getToken } from "@/lib/auth";

const LINKS = [
  { href: "/admin/units", label: "Jednostki", hint: "Teren i kompetencje" },
  { href: "/admin/projects", label: "Projekty", hint: "Przydział do jednostek" },
  { href: "/admin/catalog", label: "Katalog projektów", hint: "Przegląd projektów z bazy" },
  { href: "/admin/proposals", label: "Propozycje", hint: "Z czatu → do jednostki" },
  { href: "/admin/reports", label: "Sprawy", hint: "Statusy dla mieszkańców" },
  { href: "/admin/knowledge", label: "Zasobnik wiedzy", hint: "Raporty, materiały, biblioteka" },
  { href: "/admin/testing", label: "Zgłoszenia testerów", hint: "Przyjmij / odrzuć testerów, opinie" },
  { href: "/admin/messages", label: "Wiadomości", hint: "Pytania do zespołu ROPS" },
  { href: "/admin/trends", label: "Trendy potrzeb", hint: "Potrzeby według obszarów" },
  { href: "/admin/users", label: "Użytkownicy", hint: "Konta i rola mentora" },
] as const;

export function AdminOverview() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    fetchAdminStats(token)
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

      <section className="flex flex-wrap gap-x-10 gap-y-4 text-sm">
        <Stat label="Użytkownicy" value={stats?.users_total} />
        <Stat label="Jednostki" value={stats?.units_total} />
        <Stat label="Projekty" value={stats?.projects_total} />
        <Stat label="Sprawy" value={stats?.reports_total} />
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
