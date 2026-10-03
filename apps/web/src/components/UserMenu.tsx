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

/** Kółko z inicjałami → dropdown: profil, admin, wylogowanie. */
export function UserMenu({ user: userProp, isAdmin: isAdminProp }: UserMenuProps) {
  const router = useRouter();
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
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
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
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
        className="user-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={label}
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden="true">{user ? initials(user) : "…"}</span>
      </button>
      {open && (
        <div id={menuId} role="menu" className="user-menu-dropdown" aria-label="Konto">
          {user && (
            <p className="user-menu-meta">
              <span className="user-menu-name">
                {user.name} {user.surname}
              </span>
              <span className="user-menu-email">{user.email}</span>
            </p>
          )}
          <Link
            href="/profil"
            role="menuitem"
            className="user-menu-item"
            onClick={() => setOpen(false)}
          >
            Profil
          </Link>
          {isAdmin && (
            <Link
              href="/admin"
              role="menuitem"
              className="user-menu-item"
              onClick={() => setOpen(false)}
            >
              Panel admina
            </Link>
          )}
          <button type="button" role="menuitem" className="user-menu-item" onClick={logout}>
            Wyloguj się
          </button>
        </div>
      )}
    </div>
  );
}
