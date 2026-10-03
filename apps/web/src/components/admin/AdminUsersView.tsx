import { useEffect, useState } from "react";

import { fetchAdminUsers, type User } from "@/lib/api";
import { getToken } from "@/lib/auth";

export function AdminUsersView() {
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    fetchAdminUsers(token)
      .then(setUsers)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Nie udało się pobrać użytkowników"),
      )
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="text-sm text-[var(--muted)]">Ładowanie użytkowników…</p>;
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      )}
      <div className="surface overflow-x-auto">
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
              <tr
                key={user.id}
                className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--accent-soft)]"
              >
                <td className="px-4 py-3 font-mono text-[var(--muted)]">{user.id}</td>
                <td className="px-4 py-3">{user.email}</td>
                <td className="px-4 py-3">{user.full_name ?? "—"}</td>
                <td className="px-4 py-3">
                  <span
                    className={
                      user.role === "admin"
                        ? "font-medium text-[var(--accent)]"
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
    </div>
  );
}
