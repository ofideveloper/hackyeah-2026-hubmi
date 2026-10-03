import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import type { ReactNode } from "react";

import { useRequireAdmin } from "@/hooks/useRequireAdmin";

const NAV: { href: string; label: string; exact?: boolean }[] = [
  { href: "/admin", label: "Przegląd", exact: true },
  { href: "/admin/units", label: "Jednostki" },
  { href: "/admin/projects", label: "Projekty" },
  { href: "/admin/reports", label: "Sprawy" },
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

  if (gate.status !== "ready") {
    return null;
  }

  return (
    <>
      <Head>
        <title>{title} · Admin · HubMI</title>
      </Head>
      <div className="admin-shell min-h-screen">
        <aside className="admin-sidebar" aria-label="Panel admina">
          <div className="admin-sidebar-brand">
            <Link href="/admin" className="font-display text-sm font-semibold text-[var(--accent)]">
              HubMI Admin
            </Link>
            <p className="mt-1 truncate text-xs text-[var(--muted)]">
              {gate.admin.full_name ?? gate.admin.email}
            </p>
          </div>

          <nav className="admin-nav">
            {NAV.map((item) => {
              const active = item.exact
                ? router.pathname === item.href
                : router.pathname === item.href || router.pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`admin-nav-link ${active ? "admin-nav-link-active" : ""}`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="admin-sidebar-footer">
            <Link href="/app" className="admin-nav-link">
              Aplikacja
            </Link>
            <button type="button" onClick={gate.logout} className="admin-nav-link text-left">
              Wyloguj
            </button>
          </div>
        </aside>

        <div className="admin-main">
          <header className="admin-main-header">
            <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
              {title}
            </h1>
            {description && (
              <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">{description}</p>
            )}
          </header>
          <div className="admin-main-body animate-soft-in">{children}</div>
        </div>
      </div>
    </>
  );
}
