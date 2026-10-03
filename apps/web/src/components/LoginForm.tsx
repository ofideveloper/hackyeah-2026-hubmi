import Link from "next/link";
import { useRouter } from "next/router";
import { useId, useState, type FormEvent } from "react";

import { fetchMe, loginUser } from "@/lib/api";
import { setToken } from "@/lib/auth";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const errorId = useId();
  // Po rejestracji: trwały komunikat zamiast znikającego przed przekierowaniem
  const justRegistered = router.query.registered === "1";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const token = await loginUser(email, password);
      setToken(token);
      const me = await fetchMe(token);
      await router.push(me.role === "admin" ? "/admin" : "/app");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Logowanie nie powiodło się");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      aria-describedby={error ? errorId : undefined}
      className="surface animate-fade-up w-full max-w-md p-8"
    >
      <h1 className="font-display text-2xl font-semibold tracking-tight">Zaloguj się</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Wejdź do MaloHUB - opiekun, wiedza, pomysły i kontakt w jednym miejscu.
      </p>

      <p className="mt-4 text-sm font-medium text-[var(--success)]" role="status">
        {justRegistered ? "Konto utworzone. Możesz się zalogować." : ""}
      </p>

      <div className="mt-7 space-y-4">
        <label className="block text-sm">
          <span className="mb-1.5 block text-[var(--muted)]">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="field"
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
            className="field"
            placeholder="••••••••"
            autoComplete="current-password"
          />
        </label>
      </div>

      {error && (
        <p id={errorId} className="mt-4 text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      )}

      <button type="submit" disabled={loading} className="btn-primary mt-6 w-full">
        {loading ? "Logowanie…" : "Zaloguj się"}
      </button>

      <p className="mt-5 text-center text-sm text-[var(--muted)]">
        Nie masz konta?{" "}
        <Link href="/register" className="text-[var(--accent)] underline underline-offset-2">
          Załóż konto
        </Link>
        {" · "}
        <Link href="/" className="text-[var(--accent)] underline underline-offset-2">
          Start
        </Link>
      </p>
    </form>
  );
}
