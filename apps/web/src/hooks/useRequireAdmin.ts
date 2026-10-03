import { useRouter } from "next/router";
import { useEffect, useState } from "react";

import { fetchMe, type User } from "@/lib/api";
import { clearToken, getToken } from "@/lib/auth";

type AdminGate =
  | { status: "loading"; admin: null; error: null }
  | { status: "ready"; admin: User; error: null }
  | { status: "denied"; admin: null; error: string };

/**
 * Chroni podwidoki `/admin/*` — wymaga JWT + role=admin.
 * User bez uprawnień → `/app`, brak tokena → `/login`.
 */
export function useRequireAdmin() {
  const router = useRouter();
  const [gate, setGate] = useState<AdminGate>({
    status: "loading",
    admin: null,
    error: null,
  });

  useEffect(() => {
    const token = getToken();
    if (!token) {
      void router.replace("/login");
      return;
    }

    let cancelled = false;
    fetchMe(token)
      .then((me) => {
        if (cancelled) return;
        if (me.role !== "admin") {
          setGate({ status: "denied", admin: null, error: "Brak uprawnień administratora" });
          void router.replace("/app");
          return;
        }
        setGate({ status: "ready", admin: me, error: null });
      })
      .catch(() => {
        if (cancelled) return;
        clearToken();
        setGate({ status: "denied", admin: null, error: "Sesja wygasła" });
        void router.replace("/login");
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  function logout() {
    clearToken();
    void router.push("/login");
  }

  return { ...gate, logout };
}
