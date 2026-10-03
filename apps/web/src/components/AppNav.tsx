import Link from "next/link";
import { useEffect, useState } from "react";

import { HeaderLoginLink } from "@/components/HeaderAuthLinks";
import { UserMenu } from "@/components/UserMenu";
import { fetchConversations, type User } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { unreadCount } from "@/lib/communication";

/** Strony z wspólnym menu produktowym — `current` podświetla aktywną pozycję. */
export type AppNavPage = "wiedza" | "kreator" | "tester" | "kontakt" | "app" | "profil";

const NAV_ITEMS: { id: Exclude<AppNavPage, "app" | "profil">; href: string; label: string }[] = [
  { id: "wiedza", href: "/wiedza", label: "Zasobnik wiedzy" },
  { id: "kreator", href: "/kreator", label: "Kreator pomysłów" },
  { id: "tester", href: "/tester", label: "Tester innowacji" },
  { id: "kontakt", href: "/kontakt", label: "Kontakt" },
];

function navLinkClass(active: boolean): string {
  return active ? "site-header-link site-header-link-active" : "site-header-link";
}

type LoggedInMenuProps = {
  /** Którą pozycję podświetlić; pomiń na landingu */
  current?: AppNavPage;
  isAdmin?: boolean;
  unreadKontakt?: number;
  user?: User | null;
};

/**
 * Wspólne menu zalogowanego użytkownika.
 * Linki → wyróżnione „Zapytaj opiekuna” → kółko konta z dropdownem.
 */
export function LoggedInMenu({
  current,
  isAdmin,
  unreadKontakt: unreadProp,
  user,
}: LoggedInMenuProps) {
  const [unread, setUnread] = useState(unreadProp ?? 0);

  useEffect(() => {
    if (unreadProp !== undefined) setUnread(unreadProp);
  }, [unreadProp]);

  useEffect(() => {
    if (unreadProp !== undefined) return;
    const token = getToken();
    if (!token) return;
    fetchConversations(token)
      .then((threads) => setUnread(unreadCount(threads)))
      .catch(() => undefined);
  }, [unreadProp]);

  return (
    <>
      {NAV_ITEMS.map((item) => {
        const active = item.id === current;
        return (
          <Link
            key={item.id}
            href={item.href}
            className={navLinkClass(active)}
            aria-current={active ? "page" : undefined}
          >
            {item.label}
            {item.id === "kontakt" && unread > 0 ? ` (nowe: ${unread})` : ""}
          </Link>
        );
      })}
      <Link
        href="/app"
        className={
          current === "app" ? "btn-primary site-header-cta site-header-cta-active" : "btn-primary site-header-cta"
        }
        aria-current={current === "app" ? "page" : undefined}
      >
        Zapytaj opiekuna
      </Link>
      <UserMenu user={user} isAdmin={isAdmin} />
    </>
  );
}

type GuestProductNavProps = {
  current?: AppNavPage;
};

/** Te same linki produktowe dla gościa — opiekun wyróżniony, potem logowanie. */
function GuestProductNav({ current }: GuestProductNavProps) {
  return (
    <>
      {NAV_ITEMS.map((item) => {
        const active = item.id === current;
        return (
          <Link
            key={item.id}
            href={item.href}
            className={navLinkClass(active)}
            aria-current={active ? "page" : undefined}
          >
            {item.label}
          </Link>
        );
      })}
      <Link
        href="/#opiekun"
        className={
          current === "app" ? "btn-primary site-header-cta site-header-cta-active" : "btn-primary site-header-cta"
        }
      >
        Zapytaj opiekuna
      </Link>
      <HeaderLoginLink />
    </>
  );
}

type AppNavProps = {
  /** Którą pozycję podświetlić; pomiń gdy żadna (np. landing) */
  current?: AppNavPage;
  isAdmin?: boolean;
  unreadKontakt?: number;
  user?: User | null;
};

/**
 * Menu w `SiteHeader` na stronach produktowych i landingu po zalogowaniu.
 * Sam wybiera wariant gość / zalogowany.
 */
export function AppNav({ current, isAdmin, unreadKontakt, user }: AppNavProps) {
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    setLoggedIn(Boolean(getToken()));
  }, []);

  if (!loggedIn) {
    return <GuestProductNav current={current} />;
  }

  return (
    <LoggedInMenu
      current={current}
      isAdmin={isAdmin}
      unreadKontakt={unreadKontakt}
      user={user}
    />
  );
}

/** @deprecated Użyj `AppNav` — alias dla kompatybilności. */
export const ProductHeaderActions = AppNav;
