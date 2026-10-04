import { useRouter } from "next/router";
import { useEffect, useState } from "react";

import { useAuth } from "@/hooks/useAuth";
import type { User } from "@/lib/api";

type AdminGate =
  | { status: "loading"; admin: null; error: null }
  | { status: "ready"; admin: User; error: null }
  | { status: "denied"; admin: null; error: string };

/**
 * Chroni podwidoki `/admin/*` — wymaga JWT + role=admin.
 * User bez uprawnień → `/app`, brak tokena → `/login`.
 * Korzysta z globalnego AuthProvider (bez ponownego fetchMe przy każdej podstronie).
 */
export function useRequireAdmin() {
  const router = useRouter();
  const { status, user, logout: authLogout } = useAuth();
  const [gate, setGate] = useState<AdminGate>({
    status: "loading",
    admin: null,
    error: null,
  });

  useEffect(() => {
    // Czekaj na bootstrap AuthProvider — `anonymous` przed sprawdzeniem tokena = fałszywy logout
    if (status === "loading") {
      setGate({ status: "loading", admin: null, error: null });
      return;
    }

    if (status === "anonymous") {
      setGate({ status: "denied", admin: null, error: "Sesja wygasła" });
      void router.replace("/login");
      return;
    }

    if (!user) {
      setGate({ status: "loading", admin: null, error: null });
      return;
    }

    if (user.role !== "admin") {
      setGate({ status: "denied", admin: null, error: "Brak uprawnień administratora" });
      void router.replace("/app");
      return;
    }

    setGate({ status: "ready", admin: user, error: null });
  }, [status, user, router]);

  function logout() {
    authLogout();
    void router.push("/login");
  }

  return { ...gate, logout };
}
