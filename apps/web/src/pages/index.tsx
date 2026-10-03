import Head from "next/head";
import Link from "next/link";

export default function HomePage() {
  return (
    <>
      <Head>
        <title>HubMI</title>
        <meta
          name="description"
          content="Zgłaszaj problemy i wydarzenia w swojej jednostce. HubMI dopasowuje treść i łączy podobne sprawy."
        />
      </Head>
      <main className="relative mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-16">
        <p className="font-display animate-fade-up text-5xl font-semibold tracking-tight text-[var(--text)] sm:text-6xl">
          HubMI
        </p>
        <h1 className="animate-fade-up-delay mt-5 max-w-xl text-xl font-medium leading-snug text-[var(--muted)] sm:text-2xl">
          Zgłaszaj problemy i wydarzenia w swojej jednostce.
        </h1>
        <div
          className="animate-soft-in mt-10 flex flex-wrap gap-3"
          style={{ animationDelay: "0.22s" }}
        >
          <Link href="/login" className="btn-primary">
            Zaloguj się
          </Link>
          <Link href="/register" className="btn-ghost">
            Załóż konto
          </Link>
        </div>
      </main>
    </>
  );
}
