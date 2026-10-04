import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useState, type FormEvent } from "react";

import { AppNav, SiteHeader } from "@/components/SiteHeader";
import { useAuth } from "@/hooks/useAuth";
import { changeMyPassword } from "@/lib/api";

export default function ProfilePage() {
  const router = useRouter();
  const { status, user, sessionHint } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    // Dopiero po bootstrapie AuthProvider — unikaj redirectu przy statusie przejściowym
    if (status === "loading") return;
    if (status === "anonymous") {
      void router.replace("/login");
    }
  }, [status, router]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (newPassword.length < 8) {
      setError("Nowe hasło musi mieć co najmniej 8 znaków");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Nowe hasła nie są takie same");
      return;
    }

    if (!sessionHint) {
      void router.replace("/login");
      return;
    }

    setBusy(true);
    try {
      await changeMyPassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccess("Hasło zostało zmienione");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się zmienić hasła");
    } finally {
      setBusy(false);
    }
  }

  if (status === "loading" || status === "anonymous" || !user) {
    return (
      <main className="mx-auto flex min-h-screen max-w-7xl items-center justify-center px-6">
        <p className="text-[var(--muted)]">Ładowanie…</p>
      </main>
    );
  }

  return (
    <>
      <Head>
        <title>Profil · MaloHUB</title>
      </Head>

      <a href="#tresc" className="skip-link">
        Przejdź do treści
      </a>
      <SiteHeader width="full" actions={<AppNav current="profil" />} />

      <main id="tresc" className="kb-page mx-auto max-w-7xl px-6 pb-20 pt-10 sm:px-10 sm:pt-14">
        <header className="animate-fade-up">
          <p className="kb-meta">Konto</p>
          <h1 className="font-display mt-3 max-w-3xl text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
            Twój <span className="text-[var(--accent)]">profil</span>
          </h1>
          <p className="mt-4 max-w-2xl leading-7 text-[var(--muted)]">
            Dane konta i zmiana hasła. Sektor oraz organizację ustawisz też w zakładce Kontakt.
          </p>
        </header>

        <section className="surface mt-10 max-w-xl space-y-3 p-6" aria-labelledby="dane-konta">
          <h2 id="dane-konta" className="font-display text-xl font-semibold">
            Dane konta
          </h2>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-[var(--muted)]">Imię i nazwisko</dt>
              <dd className="mt-1 font-medium">
                {user.name} {user.surname}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">E-mail</dt>
              <dd className="mt-1 font-medium">{user.email}</dd>
            </div>
            {user.phone_number && (
              <div>
                <dt className="text-[var(--muted)]">Telefon</dt>
                <dd className="mt-1 font-medium">{user.phone_number}</dd>
              </div>
            )}
            {user.organization && (
              <div>
                <dt className="text-[var(--muted)]">Organizacja</dt>
                <dd className="mt-1 font-medium">{user.organization}</dd>
              </div>
            )}
          </dl>
        </section>

        <section className="surface mt-6 max-w-xl p-6" aria-labelledby="zmiana-hasla">
          <h2 id="zmiana-hasla" className="font-display text-xl font-semibold">
            Zmiana hasła
          </h2>
          <form className="mt-5 space-y-4" onSubmit={onSubmit}>
            <label className="block text-sm">
              <span className="mb-1.5 block text-[var(--muted)]">Obecne hasło</span>
              <input
                type="password"
                className="field"
                autoComplete="current-password"
                required
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1.5 block text-[var(--muted)]">Nowe hasło</span>
              <input
                type="password"
                className="field"
                autoComplete="new-password"
                required
                minLength={8}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1.5 block text-[var(--muted)]">Powtórz nowe hasło</span>
              <input
                type="password"
                className="field"
                autoComplete="new-password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </label>
            {error && (
              <p className="text-sm text-red-700" role="alert">
                {error}
              </p>
            )}
            {success && (
              <p className="text-sm text-emerald-700" role="status">
                {success}
              </p>
            )}
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? "Zapisywanie…" : "Zmień hasło"}
            </button>
          </form>
        </section>
      </main>
    </>
  );
}
