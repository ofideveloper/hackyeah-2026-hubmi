import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

import { AssistantChat } from "@/components/AssistantChat";
import { fetchMe, fetchMyReports, type Report, type User } from "@/lib/api";
import { clearToken, getToken } from "@/lib/auth";

const STATUS_LABEL: Record<string, string> = {
  nowe: "Przyjęte",
  w_toku: "W trakcie",
  zakonczone: "Zakończone",
};

function statusClass(status: string): string {
  if (status === "zakonczone") return "status-pill status-pill-done";
  if (status === "w_toku") return "status-pill status-pill-progress";
  return "status-pill status-pill-new";
}

export default function AppHomePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      void router.replace("/login");
      return;
    }

    fetchMe(token)
      .then(async (me) => {
        setUser(me);
        const nextReports = await fetchMyReports(token).catch(() => [] as Report[]);
        setReports(nextReports);
      })
      .catch(() => {
        clearToken();
        void router.replace("/login");
      })
      .finally(() => setLoading(false));
  }, [router]);

  function logout() {
    clearToken();
    void router.push("/login");
  }

  if (loading || !user) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-6">
        <p className="text-[var(--muted)]">Ładowanie…</p>
      </main>
    );
  }

  return (
    <>
      <Head>
        <title>MaloHUB</title>
      </Head>
      <main className="animate-soft-in mx-auto min-h-screen max-w-3xl px-6 py-12">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--border)] pb-8">
          <div>
            <p className="font-display text-sm font-semibold text-[var(--accent)]">MaloHUB</p>
            <h1 className="font-display mt-1 text-3xl font-semibold tracking-tight">
              Twoja przestrzeń
            </h1>
            <p className="mt-2 max-w-md text-sm text-[var(--muted)]">
              Porozmawiaj ze społecznym opiekunem. Status Twoich spraw zobaczysz tutaj, gdy
              pojawią się w systemie.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/kreator" className="btn-ghost">
              Kreator pomysłów
            </Link>
            <Link href="/wiedza" className="btn-ghost">
              Zasobnik wiedzy
            </Link>
            {user.role === "admin" && (
              <Link href="/admin" className="btn-ghost">
                Admin
              </Link>
            )}
            <button type="button" onClick={logout} className="btn-ghost">
              Wyloguj
            </button>
          </div>
        </header>

        <section className="mt-8">
          <AssistantChat
            userName={user.full_name || `${user.name} ${user.surname}`.trim()}
            onReportCreated={(report) =>
              setReports((prev) => [report, ...prev.filter((r) => r.id !== report.id)])
            }
          />
        </section>

        <section className="mt-12">
          <h2 className="font-display text-lg font-semibold tracking-tight">Twoje sprawy</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Statusy aktualizuje zespół — Ty tylko śledzisz postęp.
          </p>
          <ul className="mt-5 space-y-3">
            {reports.length === 0 && (
              <li className="surface px-5 py-6 text-sm leading-relaxed text-[var(--muted)]">
                Na razie cisza. Gdy opiekun lub system otworzy sprawę w Twoim imieniu, zobaczysz
                ją tutaj wraz ze statusem.
              </li>
            )}
            {reports.map((report) => (
              <li key={report.id} className="surface p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{report.title}</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {report.unit_name ?? "Jednostka do przydzielenia"}
                    </p>
                  </div>
                  <span className={statusClass(report.status ?? "nowe")}>
                    {STATUS_LABEL[report.status ?? "nowe"] ?? report.status}
                  </span>
                </div>
                {report.description && (
                  <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
                    {report.description}
                  </p>
                )}
                <p className="mt-3 text-xs text-[var(--muted)]">
                  {new Date(report.created_at).toLocaleString("pl-PL")}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}
