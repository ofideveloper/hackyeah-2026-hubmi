import { useEffect, useState } from "react";

import { fetchAdminUsers, setUserRole, type User } from "@/lib/api";
import { hasSessionHint } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/communication";

export function AdminUsersView() {
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!hasSessionHint()) return;
    fetchAdminUsers()
      .then(setUsers)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Nie udało się pobrać użytkowników"),
      )
      .finally(() => setLoading(false));
  }, []);

  async function onMentor(user: User) {
    if (!hasSessionHint()) return;
    setBusyId(user.id);
    setError(null);
    try {
      const saved = await setUserRole(
        user.id,
        user.role === "specialist" ? "user" : "specialist",
      );
      setUsers((prev) => prev.map((row) => (row.id === saved.id ? saved : row)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się zmienić roli");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return <p className="text-sm text-[var(--muted)]" role="status">Ładowanie użytkowników…</p>;
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      )}
      <div className="surface overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <caption className="sr-only">Użytkownicy</caption>
          <thead className="border-b border-[var(--border)] text-[var(--muted)]">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Email</th>
              <th scope="col" className="px-4 py-3 font-medium">Imię</th>
              <th scope="col" className="px-4 py-3 font-medium">Nazwisko</th>
              <th scope="col" className="px-4 py-3 font-medium">Telefon</th>
              <th scope="col" className="px-4 py-3 font-medium">Rola</th>
              <th scope="col" className="px-4 py-3 font-medium">Akcje</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr
                key={user.id}
                className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--accent-soft)]"
              >
                <td className="px-4 py-3">{user.email}</td>
                <td className="px-4 py-3">{user.name || "—"}</td>
                <td className="px-4 py-3">{user.surname || "—"}</td>
                <td className="px-4 py-3">{user.phone_number ?? "—"}</td>
                <td className="px-4 py-3">
                  <span
                    className={
                      user.role === "user"
                        ? "text-[var(--muted)]"
                        : "font-medium text-[var(--accent-text)]"
                    }
                  >
                    {ROLE_LABEL[user.role] ?? user.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {/* rola admina pochodzi z seeda — API nie pozwala jej zmienić */}
                  {user.role !== "admin" && (
                    <button
                      type="button"
                      className="btn-ghost"
                      disabled={busyId === user.id}
                      onClick={() => void onMentor(user)}
                    >
                      {user.role === "specialist" ? "Odbierz rolę mentora" : "Nadaj rolę mentora"}
                      <span className="sr-only">: {user.email}</span>
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
