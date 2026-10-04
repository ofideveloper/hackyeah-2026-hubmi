import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { fetchMe, isUnauthorizedError, loginUser, logoutUser, type User } from "@/lib/api";
import {
  clearSessionHint,
  dropLegacyToken,
  hasSessionHint,
  markSessionHint,
} from "@/lib/auth";

export type AuthStatus = "loading" | "authenticated" | "anonymous";

type AuthContextValue = {
  status: AuthStatus;
  user: User | null;
  /** Przeglądarka ma znacznik sesji — user może się jeszcze ładować (`status === "loading"`). */
  sessionHint: boolean;
  /** Nav / CTA: `authenticated` albo bootstrap z hintem (bez migania „Zaloguj się”). */
  isLoggedIn: boolean;
  /** Mutacje i fetch chronione — tylko po udanym `/auth/me`. */
  canUseSession: boolean;
  isAdmin: boolean;
  /** Loguje przez BFF (JWT trafia do cookie HttpOnly) i dociąga `/auth/me`. */
  login: (email: string, password: string) => Promise<User>;
  /** Aktualizuje cache (np. po edycji profilu). */
  setUser: (user: User | null) => void;
  /** Ponownie pobiera `/auth/me` (gdy jest sesja). */
  refreshUser: () => Promise<User | null>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

type AuthProviderProps = {
  children: ReactNode;
  /** User z SSR (`_app.getInitialProps`) — pierwszy render już zna sesję. */
  initialUser?: User | null;
};

export function AuthProvider({ children, initialUser = null }: AuthProviderProps) {
  // SSR / getInitialProps: jeśli serwer już zna usera, nie zaczynaj od „anonymous”.
  const [status, setStatus] = useState<AuthStatus>(() =>
    initialUser ? "authenticated" : "loading",
  );
  const [user, setUserState] = useState<User | null>(() => initialUser);
  const [sessionHint, setSessionHint] = useState(() => Boolean(initialUser));

  const setAnonymous = useCallback((clearHint = true) => {
    if (clearHint) {
      clearSessionHint();
      setSessionHint(false);
    }
    setUserState(null);
    setStatus("anonymous");
  }, []);

  const applyUser = useCallback((me: User) => {
    markSessionHint();
    setSessionHint(true);
    setUserState(me);
    setStatus("authenticated");
  }, []);

  const setUser = useCallback((next: User | null) => {
    setUserState(next);
    if (next) {
      markSessionHint();
      setSessionHint(true);
      setStatus("authenticated");
    }
  }, []);

  const logout = useCallback(() => {
    setAnonymous(true);
    void logoutUser().catch(() => undefined);
  }, [setAnonymous]);

  const loadUser = useCallback(async (): Promise<User> => {
    setSessionHint(true);
    setStatus("loading");
    const me = await fetchMe();
    applyUser(me);
    return me;
  }, [applyUser]);

  const refreshUser = useCallback(async (): Promise<User | null> => {
    try {
      return await loadUser();
    } catch (err) {
      if (isUnauthorizedError(err)) {
        setAnonymous(true);
      }
      return null;
    }
  }, [loadUser, setAnonymous]);

  const login = useCallback(
    async (email: string, password: string): Promise<User> => {
      await loginUser(email, password);
      try {
        return await loadUser();
      } catch (err) {
        setAnonymous(true);
        throw err;
      }
    },
    [loadUser, setAnonymous],
  );

  useEffect(() => {
    dropLegacyToken();

    let cancelled = false;
    let retryTimer: number | undefined;
    let attempts = 0;

    const softRevalidate = () => {
      fetchMe()
        .then((me) => {
          if (cancelled) return;
          applyUser(me);
        })
        .catch((err) => {
          if (cancelled) return;
          if (isUnauthorizedError(err)) {
            setAnonymous(true);
          }
          // Sieć / 5xx: zostaw usera z SSR — nie wyrzucaj na /login.
        });
    };

    // Serwer już zna usera — od razu oznacz hint i tylko odśwież w tle.
    if (initialUser) {
      markSessionHint();
      setSessionHint(true);
      softRevalidate();
      return () => {
        cancelled = true;
      };
    }

    const hinted = hasSessionHint();
    setSessionHint(hinted);
    setStatus("loading");

    const bootstrap = () => {
      attempts += 1;
      // Zawsze próbuj `/auth/me` — HttpOnly cookie może istnieć nawet gdy hint zniknął.
      fetchMe()
        .then((me) => {
          if (cancelled) return;
          applyUser(me);
        })
        .catch((err) => {
          if (cancelled) return;
          if (isUnauthorizedError(err)) {
            setAnonymous(true);
            return;
          }
          // Sieć / 5xx: nie kasuj hintu i nie ustawiaj `anonymous` (to wyrzuca z /app na /login).
          if (attempts < 3) {
            retryTimer = window.setTimeout(bootstrap, 350 * attempts);
            return;
          }
          if (hinted || hasSessionHint()) {
            setSessionHint(true);
            setStatus("loading");
            return;
          }
          setAnonymous(false);
        });
    };

    bootstrap();

    return () => {
      cancelled = true;
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
    };
    // initialUser tylko z pierwszego SSR mount — client navigations nie remountują providera.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyUser, setAnonymous]);

  const isLoggedIn = status === "authenticated" || (status === "loading" && sessionHint);
  const canUseSession = status === "authenticated";

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      sessionHint,
      isLoggedIn,
      canUseSession,
      isAdmin: user?.role === "admin",
      login,
      setUser,
      refreshUser,
      logout,
    }),
    [status, user, sessionHint, isLoggedIn, canUseSession, login, setUser, refreshUser, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth musi być użyty wewnątrz AuthProvider");
  }
  return ctx;
}
