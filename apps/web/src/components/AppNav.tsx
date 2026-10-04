import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
  caretakerHref as caretakerHrefFor,
  HeaderLoginLink,
  HeaderRegisterLink,
} from "@/components/HeaderAuthLinks";
import { UserMenu } from "@/components/UserMenu";
import { useAuth } from "@/hooks/useAuth";
import { fetchConversations, type User } from "@/lib/api";
import { unreadCount } from "@/lib/communication";

/** Strony z wspólnym menu produktowym — `current` podświetla aktywną pozycję. */
export type AppNavPage =
  | "wiedza"
  | "kreator"
  | "tester"
  | "kontakt"
  | "app"
  | "profil";

const NAV_ITEMS: { id: Exclude<AppNavPage, "app" | "profil">; href: string; label: string }[] = [
  { id: "wiedza", href: "/wiedza", label: "Zasobnik wiedzy" },
  { id: "kreator", href: "/kreator", label: "Kreator pomysłów" },
  { id: "tester", href: "/tester", label: "Tester innowacji" },
  { id: "kontakt", href: "/kontakt", label: "Kontakt" },
];

function navLinkClass(active: boolean): string {
  return active ? "site-header-link site-header-link-active" : "site-header-link";
}

function drawerLinkClass(active: boolean): string {
  return active ? "site-header-drawer-link site-header-drawer-link-active" : "site-header-drawer-link";
}

type NavContentProps = {
  current?: AppNavPage;
  unread: number;
  loggedIn: boolean;
  isAdmin?: boolean;
  user?: User | null;
  onNavigate?: () => void;
  /** desktop = poziomy pasek; drawer = panel mobilny */
  variant: "desktop" | "drawer";
};

function NavContent({
  current,
  unread,
  loggedIn,
  isAdmin,
  user,
  onNavigate,
  variant,
}: NavContentProps) {
  const router = useRouter();
  const { logout } = useAuth();
  const linkClass = variant === "drawer" ? drawerLinkClass : navLinkClass;
  const caretakerHref = caretakerHrefFor(loggedIn);
  const caretakerActive = current === "app";

  function handleLogout() {
    logout();
    onNavigate?.();
    void router.push("/");
  }

  function focusCaretakerComposer() {
    const input = document.getElementById("chat-message-input");
    input?.scrollIntoView({ behavior: "smooth", block: "center" });
    if (input instanceof HTMLTextAreaElement) {
      window.setTimeout(() => input.focus({ preventScroll: true }), 280);
    }
  }

  return (
    <>
      {NAV_ITEMS.map((item) => {
        const active = item.id === current;
        return (
          <Link
            key={item.id}
            href={item.href}
            className={linkClass(active)}
            aria-current={active ? "page" : undefined}
            onClick={onNavigate}
          >
            {item.label}
            {item.id === "kontakt" && unread > 0 ? ` (nowe: ${unread})` : ""}
          </Link>
        );
      })}

      <Link
        href={caretakerHref}
        className={
          variant === "drawer"
            ? `btn-primary site-header-drawer-cta${caretakerActive ? " site-header-cta-active" : ""}`
            : caretakerActive
              ? "btn-primary site-header-cta site-header-cta-active"
              : "btn-primary site-header-cta"
        }
        aria-current={caretakerActive ? "page" : undefined}
        onClick={() => {
          onNavigate?.();
          if (loggedIn && (current === "app" || router.pathname === "/app")) {
            focusCaretakerComposer();
          }
        }}
      >
        Zapytaj opiekuna
      </Link>

      {variant === "desktop" && loggedIn && <UserMenu user={user} isAdmin={isAdmin} />}

      {variant === "desktop" && !loggedIn && <HeaderLoginLink />}

      {variant === "drawer" && !loggedIn && (
        <div className="site-header-drawer-auth">
          <HeaderLoginLink className="site-header-drawer-auth-btn" />
          <HeaderRegisterLink className="site-header-drawer-auth-btn" />
        </div>
      )}

      {variant === "drawer" && loggedIn && (
        <div className="site-header-drawer-account">
          {user && (
            <p className="site-header-drawer-user">
              <span className="site-header-drawer-user-name">
                {user.name} {user.surname}
              </span>
              <span className="site-header-drawer-user-email">{user.email}</span>
            </p>
          )}
          <Link
            href="/profil"
            className={drawerLinkClass(current === "profil")}
            aria-current={current === "profil" ? "page" : undefined}
            onClick={onNavigate}
          >
            Profil
          </Link>
          {isAdmin && (
            <Link href="/admin" className="site-header-drawer-link" onClick={onNavigate}>
              Panel admina
            </Link>
          )}
          <button type="button" className="site-header-drawer-link" onClick={handleLogout}>
            Wyloguj się
          </button>
        </div>
      )}
    </>
  );
}

type LoggedInMenuProps = {
  current?: AppNavPage;
  isAdmin?: boolean;
  unreadKontakt?: number;
  user?: User | null;
};

/**
 * Wspólne menu zalogowanego (desktop) — zachowane dla kompatybilności.
 * Preferuj `AppNav`, które dodaje też wariant mobilny.
 */
export function LoggedInMenu({
  current,
  isAdmin,
  unreadKontakt: unreadProp,
  user,
}: LoggedInMenuProps) {
  const { canUseSession } = useAuth();
  const [unread, setUnread] = useState(unreadProp ?? 0);

  useEffect(() => {
    if (unreadProp !== undefined) setUnread(unreadProp);
  }, [unreadProp]);

  useEffect(() => {
    if (unreadProp !== undefined) return;
    if (!canUseSession) return;
    fetchConversations()
      .then((threads) => setUnread(unreadCount(threads)))
      .catch(() => undefined);
  }, [unreadProp, canUseSession]);

  return (
    <NavContent
      current={current}
      unread={unread}
      loggedIn
      isAdmin={isAdmin}
      user={user}
      variant="desktop"
    />
  );
}

type AppNavProps = {
  current?: AppNavPage;
  isAdmin?: boolean;
  unreadKontakt?: number;
  user?: User | null;
};

/**
 * Menu produktowe w `SiteHeader` — desktop + hamburger na mobile.
 * Wariant gość / zalogowany z AuthProvider.
 */
export function AppNav({ current, isAdmin, unreadKontakt, user }: AppNavProps) {
  const router = useRouter();
  const drawerId = useId();
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const drawerRootRef = useRef<HTMLDivElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { user: authUser, isAdmin: authIsAdmin, isLoggedIn, canUseSession } = useAuth();

  const showLoggedIn = isLoggedIn;
  const resolvedUser = user ?? authUser;
  const resolvedAdmin = isAdmin ?? authIsAdmin;
  const [unread, setUnread] = useState(unreadKontakt ?? 0);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (unreadKontakt !== undefined) setUnread(unreadKontakt);
  }, [unreadKontakt]);

  useEffect(() => {
    if (unreadKontakt !== undefined) return;
    if (!canUseSession) return;
    fetchConversations()
      .then((threads) => setUnread(unreadCount(threads)))
      .catch(() => undefined);
  }, [unreadKontakt, canUseSession]);

  useEffect(() => {
    function close() {
      setOpen(false);
    }
    router.events.on("routeChangeStart", close);
    return () => {
      router.events.off("routeChangeStart", close);
    };
  }, [router.events]);

  useEffect(() => {
    const root = drawerRootRef.current;
    if (root) {
      if (open) root.removeAttribute("inert");
      else root.setAttribute("inert", "");
    }

    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        menuBtnRef.current?.focus({ preventScroll: true });
      }
    }

    // Blokada scrolla bez przesuwania layoutu (scrollbar-gutter: stable na html)
    document.documentElement.classList.add("nav-drawer-open");
    document.addEventListener("keydown", onKeyDown);

    const focusable = drawerRef.current?.querySelector<HTMLElement>(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    focusable?.focus({ preventScroll: true });

    return () => {
      document.documentElement.classList.remove("nav-drawer-open");
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const shared = {
    current,
    unread,
    loggedIn: showLoggedIn,
    isAdmin: resolvedAdmin,
    user: resolvedUser,
  };

  const drawer =
    mounted &&
    createPortal(
      <div
        ref={drawerRootRef}
        className={`site-header-drawer-root${open ? " is-open" : ""}`}
        aria-hidden={!open}
        // zamknięty panel nie może przyjmować fokusu — samo aria-hidden tego nie gwarantuje
        inert={!open}
      >
        <button
          type="button"
          className="site-header-drawer-backdrop"
          aria-label="Zamknij menu"
          tabIndex={open ? 0 : -1}
          onClick={() => {
            setOpen(false);
            menuBtnRef.current?.focus({ preventScroll: true });
          }}
        />
        <div
          ref={drawerRef}
          id={drawerId}
          className="site-header-drawer"
          role="dialog"
          aria-modal="true"
          aria-label="Menu nawigacji"
        >
          <div className="site-header-drawer-head">
            <p className="site-header-drawer-title">Menu</p>
            <button
              type="button"
              className="site-header-drawer-close"
              aria-label="Zamknij menu"
              onClick={() => {
                setOpen(false);
                menuBtnRef.current?.focus({ preventScroll: true });
              }}
            >
              <span className="site-header-drawer-close-icon" aria-hidden="true" />
            </button>
          </div>
          <nav className="site-header-drawer-nav" aria-label="Menu mobilne">
            <NavContent {...shared} variant="drawer" onNavigate={() => setOpen(false)} />
          </nav>
        </div>
      </div>,
      document.body,
    );

  return (
    <>
      <div className="site-header-desktop">
        <NavContent {...shared} variant="desktop" />
      </div>

      <div className="site-header-mobile">
        {showLoggedIn && <UserMenu user={resolvedUser} isAdmin={resolvedAdmin} />}
        <button
          ref={menuBtnRef}
          type="button"
          className="site-header-menu-btn"
          aria-expanded={open}
          aria-controls={drawerId}
          aria-label={open ? "Zamknij menu" : "Otwórz menu"}
          onClick={() => setOpen((value) => !value)}
        >
          <span className="site-header-menu-icon" aria-hidden="true" data-open={open || undefined}>
            <span />
            <span />
            <span />
          </span>
        </button>
      </div>

      {drawer}
    </>
  );
}

/** @deprecated Użyj `AppNav` — alias dla kompatybilności. */
export const ProductHeaderActions = AppNav;
