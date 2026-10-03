import Head from "next/head";
import Link from "next/link";

export default function HomePage() {
  return (
    <>
      <Head>
        <title>HubMI</title>
      </Head>
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-16">
        <p className="mb-3 font-mono text-sm tracking-wide text-[var(--accent)]">HubMI</p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Next.js (Pages) + FastAPI
        </h1>
        <p className="mt-4 max-w-xl text-lg text-[var(--muted)]">
          Monorepo z panelem administracyjnym, JWT i bazą SQLite. Frontend w{" "}
          <code className="text-[var(--text)]">apps/web</code>, API w{" "}
          <code className="text-[var(--text)]">apps/api</code>.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/admin/login"
            className="rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-[var(--bg)] transition hover:bg-[var(--accent-hover)]"
          >
            Panel admina
          </Link>
          <Link
            href="/register"
            className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-5 py-2.5 text-sm font-medium transition hover:border-[var(--muted)]"
          >
            Rejestracja użytkownika
          </Link>
        </div>
        <p className="mt-8 text-sm text-[var(--muted)]">
          Domyślny admin: <code className="text-[var(--text)]">admin@hubmi.dev</code> /{" "}
          <code className="text-[var(--text)]">admin12345</code>
        </p>
      </main>
    </>
  );
}
