/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useCallback, useState, useEffect } from "react";
import type { AuthProviderDescriptor } from "@openchamber/plugin";
import { fetchAuthProviderSnapshot } from "./authProviders";

interface AuthProviderContextValue {
  providers: AuthProviderDescriptor[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  getProviderById: (id: string) => AuthProviderDescriptor | undefined;
}

const AuthProviderContext = createContext<AuthProviderContextValue | null>(null);

export function AuthProviderProvider({ children }: { children: React.ReactNode }) {
  const [providers, setProviders] = useState<AuthProviderDescriptor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProviders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const snapshot = await fetchAuthProviderSnapshot();
      setProviders(snapshot.providers);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load auth providers");
      setProviders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProviders();
  }, [loadProviders]);

  const getProviderById = useCallback(
    (id: string) => providers.find((p) => p.id === id),
    [providers],
  );

  return (
    <AuthProviderContext.Provider
      value={{ providers, loading, error, refresh: loadProviders, getProviderById }}
    >
      {children}
    </AuthProviderContext.Provider>
  );
}

export function useAuthProviders(): AuthProviderContextValue {
  const context = useContext(AuthProviderContext);
  if (!context) {
    throw new Error("useAuthProviders must be used within AuthProviderProvider");
  }
  return context;
}
