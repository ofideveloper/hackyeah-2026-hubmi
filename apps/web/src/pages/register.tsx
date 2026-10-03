import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useState, type FormEvent } from "react";

import { registerUser } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await registerUser({
        email,
        password,
        full_name: fullName || undefined,
      });
      setSuccess(true);
      setTimeout(() => {
        void router.push("/admin/login");
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rejestracja nie powiodła się");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Head>
        <title>Rejestracja · HubMI</title>
      </Head>
      <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-6 py-12">
        <form
          onSubmit={onSubmit}
          className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-8"
        >
          <p className="mb-1 font-mono text-xs tracking-wide text-[var(--accent)]">HubMI</p>
          <h1 className="text-2xl font-semibold">Rejestracja użytkownika</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Tworzy konto z rolą <code className="text-[var(--text)]">user</code> (widoczne w
            panelu admina).
          </p>

          <div className="mt-6 space-y-4">
            <label className="block text-sm">
              <span className="mb-1.5 block text-[var(--muted)]">Imię i nazwisko</span>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5"
                autoComplete="name"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1.5 block text-[var(--muted)]">Email</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5"
                autoComplete="email"
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
                autoComplete="new-password"
              />
            </label>
          </div>

          {error && (
            <p className="mt-4 text-sm text-[var(--danger)]" role="alert">
              {error}
            </p>
          )}
          {success && (
            <p className="mt-4 text-sm text-[var(--accent)]">Konto utworzone. Przekierowanie…</p>
          )}

          <button
            type="submit"
            disabled={loading || success}
            className="mt-6 w-full rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-[var(--bg)] transition hover:bg-[var(--accent-hover)] disabled:opacity-60"
          >
            {loading ? "Zapisywanie…" : "Zarejestruj"}
          </button>
        </form>
        <Link href="/" className="mt-6 text-sm text-[var(--muted)] hover:text-[var(--text)]">
          ← Strona główna
        </Link>
      </main>
    </>
  );
}
