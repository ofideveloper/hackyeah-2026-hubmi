import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { ApiError, fetchMe, loginUser, logoutUser, type User } from "@/lib/api";
import { clearSessionHint, dropLegacyToken, hasSessionHint } from "@/lib/auth";

export type AuthStatus = "loading" | "authenticated" | "anonymous";

type AuthContextValue = {
  status: AuthStatus;
  user: User | null;
  /** Przeglądarka ma znacznik sesji — user może się jeszcze ładować (`status === "loading"`). */
  sessionHint: boolean;
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

/** 401 = sesja nieważna (BFF już czyści cookie). 502/sieć ≠ wylogowanie. */
function isUnauthorized(err: unknown): boolean {
  return err instanceof ApiError && err.status === 401;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // Start as loading — nigdy nie traktuj pierwszego renderu jako wylogowania,
  // zanim bootstrap sprawdzi sesję (inaczej /admin i /app wyrzucają na /login).
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUserState] = useState<User | null>(null);
  const [sessionHint, setSessionHint] = useState(false);
  const userRef = useRef<User | null>(null);
  userRef.current = user;

  const setAnonymous = useCallback(() => {
    clearSessionHint();
    setSessionHint(false);
    setUserState(null);
    setStatus("anonymous");
  }, []);

  const setUser = useCallback((next: User | null) => {
    setUserState(next);
    if (next) setStatus("authenticated");
  }, []);

  const logout = useCallback(() => {
    setAnonymous();
    void logoutUser().catch(() => undefined);
  }, [setAnonymous]);

  const loadUser = useCallback(async (): Promise<User> => {
    setSessionHint(true);
    setStatus("loading");
    const me = await fetchMe();
    setUserState(me);
    setStatus("authenticated");
    return me;
  }, []);

  /** Chwilowa awaria API — zostaw cookie/hint; przywróć poprzedni user jeśli był. */
  const keepSessionAfterTransient = useCallback(() => {
    setSessionHint(true);
    const previous = userRef.current;
    if (previous) {
      setUserState(previous);
      setStatus("authenticated");
      return previous;
    }
    // hint żyje, profil jeszcze nie — UI traktuje to jak trwające ładowanie sesji
    setStatus("loading");
    return null;
  }, []);

  const refreshUser = useCallback(async (): Promise<User | null> => {
    if (!hasSessionHint()) {
      setAnonymous();
      return null;
    }
    try {
      return await loadUser();
    } catch (err) {
      if (isUnauthorized(err) || !hasSessionHint()) {
        setAnonymous();
        return null;
      }
      return keepSessionAfterTransient();
    }
  }, [loadUser, setAnonymous, keepSessionAfterTransient]);

  const login = useCallback(
    async (email: string, password: string): Promise<User> => {
      await loginUser(email, password);
      try {
        return await loadUser();
      } catch (err) {
        if (isUnauthorized(err) || !hasSessionHint()) {
          setAnonymous();
        } else {
          // login ustawił cookie — nie kasuj hintu przez awarię /auth/me
          keepSessionAfterTransient();
        }
        throw err;
      }
    },
    [loadUser, setAnonymous, keepSessionAfterTransient],
  );

  useEffect(() => {
    dropLegacyToken();
    if (!hasSessionHint()) {
      setAnonymous();
      return;
    }

    let cancelled = false;
    setSessionHint(true);
    setStatus("loading");

    const bootstrap = async () => {
      try {
        const me = await fetchMe();
        if (cancelled) return;
        setUserState(me);
        setStatus("authenticated");
      } catch (err) {
        if (cancelled) return;
        if (isUnauthorized(err) || !hasSessionHint()) {
          setAnonymous();
          return;
        }
        // 502 / sieć — jedna szybka ponowna próba, potem zostaw sesję bez fałszywego logoutu
        await new Promise((r) => window.setTimeout(r, 600));
        if (cancelled) return;
        try {
          const me = await fetchMe();
          if (cancelled) return;
          setUserState(me);
          setStatus("authenticated");
        } catch (err2) {
          if (cancelled) return;
          if (isUnauthorized(err2) || !hasSessionHint()) {
            setAnonymous();
            return;
          }
          keepSessionAfterTransient();
        }
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [setAnonymous, keepSessionAfterTransient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      sessionHint,
      isAdmin: user?.role === "admin",
      login,
      setUser,
      refreshUser,
      logout,
    }),
    [status, user, sessionHint, login, setUser, refreshUser, logout],
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
