import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useState, type FormEvent, useId } from "react";

import { AppNav, SiteHeader } from "@/components/SiteHeader";
import { changeMyPassword, fetchMe, type User } from "@/lib/api";
import { clearToken, getToken } from "@/lib/auth";

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorField, setErrorField] = useState<"new" | "confirm" | null>(null);
  const errorId = useId();
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      void router.replace("/login");
      return;
    }
    fetchMe(token)
      .then(setUser)
      .catch(() => {
        clearToken();
        void router.replace("/login");
      })
      .finally(() => setLoading(false));
  }, [router]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setErrorField(null);
    setSuccess(null);

    if (newPassword.length < 8) {
      setErrorField("new");
      setError("Nowe hasło musi mieć co najmniej 8 znaków");
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorField("confirm");
      setError("Nowe hasła nie są takie same");
      return;
    }

    const token = getToken();
    if (!token) {
      void router.replace("/login");
      return;
    }

    setBusy(true);
    try {
      await changeMyPassword(token, currentPassword, newPassword);
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

  if (loading || !user) {
    return (
      <main id="tresc" tabIndex={-1} className="mx-auto flex min-h-screen max-w-7xl items-center justify-center px-6">
        <p className="text-[var(--muted)]" role="status">Ładowanie…</p>
      </main>
    );
  }

  return (
    <>
      <Head>
        <title>Profil · MaloHUB</title>
      </Head>

      <SiteHeader
        width="full"
        actions={
          <AppNav current="profil" isAdmin={user.role === "admin"} user={user} />
        }
      />

      <main id="tresc" tabIndex={-1} className="kb-page mx-auto max-w-7xl px-6 pb-20 pt-10 sm:px-10 sm:pt-14">
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
          <form
            className="mt-5 space-y-4"
            onSubmit={onSubmit}
            aria-describedby={error ? errorId : undefined}
          >
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
                aria-invalid={errorField === "new" || undefined}
                aria-describedby={errorField === "new" ? errorId : undefined}
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
                aria-invalid={errorField === "confirm" || undefined}
                aria-describedby={errorField === "confirm" ? errorId : undefined}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </label>
            {error && (
              <p id={errorId} className="text-sm text-[var(--danger)]" role="alert">
                {error}
              </p>
            )}
            {success && (
              <p className="text-sm text-[var(--success)]" role="status">
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
