import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { fetchMe, type User } from "@/lib/api";
import { clearToken, getToken, setToken } from "@/lib/auth";

export type AuthStatus = "loading" | "authenticated" | "anonymous";

type AuthContextValue = {
  status: AuthStatus;
  user: User | null;
  token: string | null;
  isAdmin: boolean;
  /** Zapisuje JWT i (opcjonalnie) usera; bez usera dociąga `/auth/me`. */
  establishSession: (token: string, user?: User) => Promise<User>;
  /** Aktualizuje cache (np. po edycji profilu). */
  setUser: (user: User | null) => void;
  /** Ponownie pobiera `/auth/me` (gdy jest token). */
  refreshUser: () => Promise<User | null>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Start as loading — nigdy nie traktuj pierwszego renderu jako wylogowania,
  // zanim bootstrap sprawdzi localStorage (inaczej /admin i /app wyrzucają na /login).
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUserState] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(null);

  const setUser = useCallback((next: User | null) => {
    setUserState(next);
    if (next) setStatus("authenticated");
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setTokenState(null);
    setUserState(null);
    setStatus("anonymous");
  }, []);

  const refreshUser = useCallback(async (): Promise<User | null> => {
    const current = getToken();
    if (!current) {
      setTokenState(null);
      setUserState(null);
      setStatus("anonymous");
      return null;
    }
    setTokenState(current);
    setStatus("loading");
    try {
      const me = await fetchMe(current);
      setUserState(me);
      setStatus("authenticated");
      return me;
    } catch {
      clearToken();
      setTokenState(null);
      setUserState(null);
      setStatus("anonymous");
      return null;
    }
  }, []);

  const establishSession = useCallback(
    async (nextToken: string, nextUser?: User): Promise<User> => {
      setToken(nextToken);
      setTokenState(nextToken);
      setStatus("loading");
      try {
        const me = nextUser ?? (await fetchMe(nextToken));
        setUserState(me);
        setStatus("authenticated");
        return me;
      } catch (err) {
        clearToken();
        setTokenState(null);
        setUserState(null);
        setStatus("anonymous");
        throw err;
      }
    },
    [],
  );

  useEffect(() => {
    const current = getToken();
    if (!current) {
      setTokenState(null);
      setUserState(null);
      setStatus("anonymous");
      return;
    }

    let cancelled = false;
    setTokenState(current);
    setStatus("loading");
    fetchMe(current)
      .then((me) => {
        if (cancelled) return;
        setUserState(me);
        setStatus("authenticated");
      })
      .catch(() => {
        if (cancelled) return;
        clearToken();
        setTokenState(null);
        setUserState(null);
        setStatus("anonymous");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      token,
      isAdmin: user?.role === "admin",
      establishSession,
      setUser,
      refreshUser,
      logout,
    }),
    [status, user, token, establishSession, setUser, refreshUser, logout],
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
