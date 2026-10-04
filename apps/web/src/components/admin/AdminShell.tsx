import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState, type ReactNode } from "react";

import { BrandLogo } from "@/components/BrandLogo";
import { useRequireAdmin } from "@/hooks/useRequireAdmin";
import { fetchAdminInbox, type AdminInbox } from "@/lib/api";

const INBOX_POLL_MS = 30_000;

/** Sekcja panelu → licznik rzeczy czekających na decyzję (`GET /admin/inbox`). */
type NavItem = {
  href: string;
  label: string;
  exact?: boolean;
  inbox?: keyof AdminInbox;
};

const NAV: NavItem[] = [
  { href: "/admin", label: "Przegląd", exact: true },
  { href: "/admin/catalog", label: "Katalog innowacji" },
  { href: "/admin/middleman", label: "Middleman Innowacji" },
  { href: "/admin/proposals", label: "Propozycje", inbox: "proposals" },
  { href: "/admin/ideas", label: "Fiszki pomysłów", inbox: "ideas" },
  { href: "/admin/knowledge", label: "Zasobnik wiedzy" },
  { href: "/admin/grants", label: "Nabory grantowe" },
  {
    href: "/admin/testing",
    label: "Zgłoszenia testerów",
    inbox: "tester_signups",
  },
  { href: "/admin/messages", label: "Wiadomości", inbox: "messages" },
  { href: "/admin/trends", label: "Trendy potrzeb" },
  { href: "/admin/users", label: "Użytkownicy" },
];

type AdminShellProps = {
  title: string;
  description?: string;
  children: ReactNode;
};

export function AdminShell({ title, description, children }: AdminShellProps) {
  const router = useRouter();
  const gate = useRequireAdmin();
  const [inbox, setInbox] = useState<AdminInbox | null>(null);
  const ready = gate.status === "ready";

  // Nowe zgłoszenia mają być widoczne bez odświeżania strony; po zmianie widoku liczymy od nowa.
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    const load = () =>
      fetchAdminInbox()
        .then((data) => {
          if (!cancelled) setInbox(data);
        })
        .catch(() => {
          // licznik jest dodatkiem — panel działa bez niego
        });
    void load();
    const timer = window.setInterval(load, INBOX_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [ready, router.pathname]);

  if (gate.status === "loading") {
    return (
      <main
        id="tresc"
        tabIndex={-1}
        className="mx-auto flex min-h-screen max-w-7xl items-center justify-center px-6"
      >
        <p className="text-[var(--muted)]" role="status">
          Ładowanie…
        </p>
      </main>
    );
  }

  if (gate.status !== "ready") {
    return null;
  }

  return (
    <>
      <Head>
        <title>{title} · Admin · MaloHUB</title>
      </Head>
      <div className="admin-shell min-h-screen">
        <aside className="admin-sidebar" aria-label="Panel admina">
          <div className="admin-sidebar-brand">
            <div className="inline-flex flex-col gap-1">
              <BrandLogo href="/admin" size="sm" label="MaloHUB Admin" />
              <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Admin
              </span>
            </div>
            <p className="mt-1 truncate text-xs text-[var(--muted)]">
              {gate.admin.full_name ||
                `${gate.admin.name} ${gate.admin.surname}`.trim() ||
                gate.admin.email}
            </p>
          </div>

          <nav className="admin-nav" aria-label="Sekcje panelu">
            {NAV.map((item) => {
              const waiting = item.inbox ? (inbox?.[item.inbox] ?? 0) : 0;
              const active = item.exact
                ? router.pathname === item.href
                : router.pathname === item.href ||
                  router.pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`admin-nav-link ${active ? "admin-nav-link-active" : ""}`}
                  aria-current={active ? "page" : undefined}
                >
                  {item.label}
                  {waiting > 0 && (
                    <span className="admin-nav-badge">
                      <span className="sr-only">, czeka: </span>
                      {waiting}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="admin-sidebar-footer">
            <Link href="/app" className="admin-nav-link">
              Aplikacja
            </Link>
            <Link href="/wiedza" className="admin-nav-link">
              Zasobnik (publiczny)
            </Link>
            <button
              type="button"
              onClick={gate.logout}
              className="admin-nav-link text-left"
            >
              Wyloguj
            </button>
          </div>
        </aside>

        <main id="tresc" tabIndex={-1} className="admin-main">
          <header className="admin-main-header">
            <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
              {title}
            </h1>
            {description && (
              <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
                {description}
              </p>
            )}
          </header>
          <div className="admin-main-body animate-soft-in">{children}</div>
        </main>
      </div>
    </>
  );
}
