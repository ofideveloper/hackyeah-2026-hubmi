import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useId, useRef, useState } from "react";

import { fetchMe, type User } from "@/lib/api";
import { clearToken, getToken } from "@/lib/auth";

function initials(user: User): string {
  const a = (user.name || "").trim().charAt(0);
  const b = (user.surname || "").trim().charAt(0);
  const both = `${a}${b}`.toLocaleUpperCase("pl");
  return both || (user.email.charAt(0) || "?").toLocaleUpperCase("pl");
}

type UserMenuProps = {
  /** Jeśli strona już ma użytkownika — unikamy drugiego fetcha */
  user?: User | null;
  isAdmin?: boolean;
};

/**
 * Kółko z inicjałami → rozwijana lista: profil, admin, wylogowanie.
 * Wzorzec disclosure (przycisk `aria-expanded` + zwykłe linki), nie `role="menu"`.
 */
export function UserMenu({ user: userProp, isAdmin: isAdminProp }: UserMenuProps) {
  const router = useRouter();
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<User | null>(userProp ?? null);
  const [isAdmin, setIsAdmin] = useState(Boolean(isAdminProp ?? userProp?.role === "admin"));

  useEffect(() => {
    if (userProp) {
      setUser(userProp);
      setIsAdmin(userProp.role === "admin");
      return;
    }
    if (isAdminProp !== undefined) setIsAdmin(isAdminProp);

    const token = getToken();
    if (!token) return;
    fetchMe(token)
      .then((me) => {
        setUser(me);
        if (isAdminProp === undefined) setIsAdmin(me.role === "admin");
      })
      .catch(() => undefined);
  }, [userProp, isAdminProp]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    }
    // Tab poza menu zamyka je — fokus nie zostaje pod rozwiniętą listą
    function onFocusIn(event: FocusEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("focusin", onFocusIn);
    };
  }, [open]);

  function logout() {
    clearToken();
    setOpen(false);
    void router.push("/");
  }

  const label = user
    ? `Menu konta: ${user.name} ${user.surname}`.trim()
    : "Menu konta";

  return (
    <div className="user-menu" ref={rootRef}>
      <button
        type="button"
        ref={triggerRef}
        className="user-menu-trigger"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={label}
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden="true">{user ? initials(user) : "…"}</span>
      </button>
      {open && (
        <div id={menuId} className="user-menu-dropdown">
          {user && (
            <p className="user-menu-meta">
              <span className="user-menu-name">
                {user.name} {user.surname}
              </span>
              <span className="user-menu-email">{user.email}</span>
            </p>
          )}
          <ul>
            <li>
              <Link href="/profil" className="user-menu-item" onClick={() => setOpen(false)}>
                Profil
              </Link>
            </li>
            {isAdmin && (
              <li>
                <Link href="/admin" className="user-menu-item" onClick={() => setOpen(false)}>
                  Panel admina
                </Link>
              </li>
            )}
            <li>
              <button type="button" className="user-menu-item" onClick={logout}>
                Wyloguj się
              </button>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
