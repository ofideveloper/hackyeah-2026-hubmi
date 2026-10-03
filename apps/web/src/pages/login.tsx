import Head from "next/head";
import Link from "next/link";

import { LoginForm } from "@/components/LoginForm";
import { SiteFooter } from "@/components/SiteFooter";

export default function LoginPage() {
  return (
    <>
      <Head>
        <title>Zaloguj się · MaloHUB</title>
      </Head>
      <div className="flex min-h-screen flex-col">
        <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center px-6 py-12">
          <LoginForm />
          <Link
            href="/"
            className="mt-6 inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-[var(--muted)] transition hover:bg-[var(--accent-soft)] hover:text-[var(--text)]"
          >
            <span aria-hidden="true">←</span>
            Wróć do strony głównej
          </Link>
        </main>
        <SiteFooter />
      </div>
    </>
  );
}
