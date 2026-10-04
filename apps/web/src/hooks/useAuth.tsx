import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { fetchMe, loginUser, logoutUser, type User } from "@/lib/api";
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

export function AuthProvider({ children }: { children: ReactNode }) {
  // Start as loading — nigdy nie traktuj pierwszego renderu jako wylogowania,
  // zanim bootstrap sprawdzi sesję (inaczej /admin i /app wyrzucają na /login).
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUserState] = useState<User | null>(null);
  const [sessionHint, setSessionHint] = useState(false);

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

  const refreshUser = useCallback(async (): Promise<User | null> => {
    if (!hasSessionHint()) {
      setAnonymous();
      return null;
    }
    try {
      return await loadUser();
    } catch {
      setAnonymous();
      return null;
    }
  }, [loadUser, setAnonymous]);

  const login = useCallback(
    async (email: string, password: string): Promise<User> => {
      await loginUser(email, password);
      try {
        return await loadUser();
      } catch (err) {
        setAnonymous();
        throw err;
      }
    },
    [loadUser, setAnonymous],
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
    fetchMe()
      .then((me) => {
        if (cancelled) return;
        setUserState(me);
        setStatus("authenticated");
      })
      .catch(() => {
        if (cancelled) return;
        setAnonymous();
      });

    return () => {
      cancelled = true;
    };
  }, [setAnonymous]);

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
