import Link from "next/link";
import { useRouter } from "next/router";
import { useState, type FormEvent } from "react";

import { fetchMe, loginUser } from "@/lib/api";
import { setToken } from "@/lib/auth";

export function AdminLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@hubmi.dev");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const token = await loginUser(email, password);
      const user = await fetchMe(token);

      if (user.role !== "admin") {
        throw new Error("To konto nie ma uprawnień administratora");
      }

      setToken(token);
      await router.push("/admin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Logowanie nie powiodło się");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-8"
    >
      <p className="mb-1 font-mono text-xs tracking-wide text-[var(--accent)]">HubMI Admin</p>
      <h1 className="text-2xl font-semibold">Panel administracyjny</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Zaloguj się kontem z rolą <code className="text-[var(--text)]">admin</code>.
      </p>

      <div className="mt-6 space-y-4">
        <label className="block text-sm">
          <span className="mb-1.5 block text-[var(--muted)]">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5"
            autoComplete="username"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1.5 block text-[var(--muted)]">Hasło</span>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5"
            placeholder="••••••••"
            autoComplete="current-password"
          />
        </label>
      </div>

      {error && (
        <p className="mt-4 text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="mt-6 w-full rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-[var(--bg)] transition hover:bg-[var(--accent-hover)] disabled:opacity-60"
      >
        {loading ? "Logowanie…" : "Zaloguj do panelu"}
      </button>

      <p className="mt-5 text-center text-sm text-[var(--muted)]">
        <Link href="/" className="text-[var(--accent)] hover:underline">
          ← Strona główna
        </Link>
      </p>
    </form>
  );
}
