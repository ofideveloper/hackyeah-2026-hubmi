import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useState, type FormEvent } from "react";

import { HeaderLoginLink, SiteHeader } from "@/components/SiteHeader";
import { registerUser } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [surname, setSurname] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const phone = phoneNumber.trim();
      await registerUser({
        email,
        password,
        name: name.trim(),
        surname: surname.trim(),
        phone_number: phone || null,
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
        <title>Załóż konto · MaloHUB</title>
      </Head>
      <div className="flex min-h-screen flex-col">
        <SiteHeader actions={<HeaderLoginLink />} />
        <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center px-6 py-12">
          <form onSubmit={onSubmit} className="surface animate-fade-up w-full max-w-md p-8">
            <h1 className="font-display text-2xl font-semibold tracking-tight">Załóż konto</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Dołącz i zacznij rozmowę ze społecznym opiekunem.
            </p>

            <div className="mt-7 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="mb-1.5 block text-[var(--muted)]">Imię</span>
                  <input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="field"
                    autoComplete="given-name"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1.5 block text-[var(--muted)]">Nazwisko</span>
                  <input
                    required
                    value={surname}
                    onChange={(e) => setSurname(e.target.value)}
                    className="field"
                    autoComplete="family-name"
                  />
                </label>
              </div>
              <label className="block text-sm">
                <span className="mb-1.5 block text-[var(--muted)]">Telefon</span>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="field"
                  autoComplete="tel"
                  placeholder="np. +48 500 000 000"
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
      </div>
    </>
  );
}
