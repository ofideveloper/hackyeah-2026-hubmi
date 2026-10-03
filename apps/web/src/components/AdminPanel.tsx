import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

import {
  fetchAdminStats,
  fetchAdminUsers,
  fetchMe,
  type AdminStats,
  type User,
} from "@/lib/api";
import { clearToken, getToken } from "@/lib/auth";

export function AdminPanel() {
  const router = useRouter();
  const [admin, setAdmin] = useState<User | null>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      void router.replace("/admin/login");
      return;
    }

    Promise.all([fetchMe(token), fetchAdminStats(token), fetchAdminUsers(token)])
      .then(([me, nextStats, nextUsers]) => {
        if (me.role !== "admin") {
          clearToken();
          throw new Error("Brak uprawnień administratora");
        }
        setAdmin(me);
        setStats(nextStats);
        setUsers(nextUsers);
      })
      .catch((err: unknown) => {
        clearToken();
        setError(err instanceof Error ? err.message : "Unauthorized");
        void router.replace("/admin/login");
      })
      .finally(() => setLoading(false));
  }, [router]);

  function logout() {
    clearToken();
    void router.push("/admin/login");
  }

  if (loading || !admin || !stats) {
    return (
      <main className="mx-auto flex min-h-screen max-w-5xl items-center justify-center px-6">
        <p className="text-[var(--muted)]">{error ?? "Ładowanie panelu…"}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-12">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs tracking-wide text-[var(--accent)]">Admin</p>
          <h1 className="mt-1 text-3xl font-semibold">Panel administracyjny</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Zalogowany jako {admin.full_name ?? admin.email}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/"
            className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm transition hover:border-[var(--muted)]"
          >
            Start
          </Link>
          <button
            type="button"
            onClick={logout}
            className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm transition hover:border-[var(--muted)]"
          >
            Wyloguj
          </button>
        </div>
      </header>

      <section className="mt-10 grid gap-4 sm:grid-cols-3">
        <StatCard label="Użytkownicy" value={stats.users_total} />
        <StatCard label="Aktywni" value={stats.users_active} />
        <StatCard label="Admini" value={stats.admins_total} />
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-medium">Lista użytkowników</h2>
        <div className="mt-4 overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)]">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-[var(--border)] text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">ID</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Nazwa</th>
                <th className="px-4 py-3 font-medium">Rola</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Utworzono</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-4 py-3 font-mono text-[var(--muted)]">{user.id}</td>
                  <td className="px-4 py-3">{user.email}</td>
                  <td className="px-4 py-3">{user.full_name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        user.role === "admin"
                          ? "text-[var(--accent)]"
                          : "text-[var(--muted)]"
                      }
                    >
                      {user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">{user.is_active ? "active" : "inactive"}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">
                    {new Date(user.created_at).toLocaleString("pl-PL")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5">
      <p className="text-xs uppercase tracking-wide text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
