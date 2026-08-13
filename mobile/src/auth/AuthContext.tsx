import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getToken, setToken as persistToken, clearToken } from "../api/client";
import { login as loginRequest, type RepvynUser } from "../api/auth";

interface AuthContextValue {
  user: RepvynUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Session is kept minimal on purpose: only the JWT is persisted (SecureStore).
// The user profile is re-derived from the login response each session rather
// than cached, since this app never needs to render it beyond a greeting.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<RepvynUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const existingToken = await getToken();
      // A stored token without a cached user means a previous session's token
      // is still valid but we don't know who it belongs to until first use;
      // treat presence of a token as "authenticated enough" to reach Home,
      // which re-fetches whatever it needs from authenticated endpoints.
      if (existingToken) {
        setUser((prev) => prev ?? { _id: "", name: "", email: "" });
      }
      setIsLoading(false);
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const response = await loginRequest(email, password);
    await persistToken(response.token);
    setUser(response.user);
  }, []);

  const logout = useCallback(async () => {
    await clearToken();
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, isLoading, isAuthenticated: !!user, login, logout }),
    [user, isLoading, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
