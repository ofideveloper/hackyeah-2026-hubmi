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
        void router.push("/login");
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
        <title>Załóż konto · HubMI</title>
      </Head>
      <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-6 py-12">
        <form onSubmit={onSubmit} className="surface animate-fade-up w-full max-w-md p-8">
          <p className="font-display text-sm font-semibold tracking-wide text-[var(--accent)]">
            HubMI
          </p>
          <h1 className="font-display mt-2 text-2xl font-semibold tracking-tight">
            Załóż konto
          </h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Dołącz do jednostki i zaczynaj zgłaszać pomysły oraz sprawy.
          </p>

          <div className="mt-7 space-y-4">
            <label className="block text-sm">
              <span className="mb-1.5 block text-[var(--muted)]">Imię i nazwisko</span>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="field"
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
                className="field"
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
                className="field"
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
            className="btn-primary mt-6 w-full"
          >
            {loading ? "Zapisywanie…" : "Załóż konto"}
          </button>

          <p className="mt-5 text-center text-sm text-[var(--muted)]">
            Masz już konto?{" "}
            <Link href="/login" className="text-[var(--accent)] hover:underline">
              Zaloguj się
            </Link>
          </p>
        </form>
      </main>
    </>
  );
}
