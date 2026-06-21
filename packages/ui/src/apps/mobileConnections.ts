// Saved-connection storage + the shared connect/unlock flow for the dedicated
// mobile app. Both the onboarding welcome screen and the Instances sheet drive
// connections through `useMobileConnection` so the health-check + progressive
// password unlock + client-token issuance + runtime switch all behave identically.

import React from 'react';

import { useI18n } from '@/lib/i18n';
import { switchRuntimeEndpoint } from '@/lib/runtime-switch';

const MOBILE_CONNECTIONS_STORAGE_KEY = 'openchamber.mobile.connections.v1';

export type MobileSavedConnection = {
  id: string;
  label: string;
  url: string;
  clientToken?: string;
  lastUsedAt: number;
};

export type MobilePendingConnection = {
  label: string;
  url: string;
  clientToken?: string;
};

export type MobileConnectInput = {
  url: string;
  clientToken?: string;
  label?: string;
};

export const normalizeConnectionUrl = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  const url = new URL(withScheme);
  url.hash = '';
  url.search = '';
  url.pathname = url.pathname.replace(/\/+$/, '');
  return url.toString().replace(/\/+$/, '');
};

export const getConnectionLabel = (url: string): string => {
  try {
    const parsed = new URL(url);
    return parsed.host;
  } catch {
    return url;
  }
};

export const loadMobileConnections = (): MobileSavedConnection[] => {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(MOBILE_CONNECTIONS_STORAGE_KEY) || '[]') as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item): MobileSavedConnection[] => {
      if (!item || typeof item !== 'object') return [];
      const candidate = item as Partial<MobileSavedConnection>;
      if (typeof candidate.id !== 'string' || typeof candidate.url !== 'string') return [];
      return [{
        id: candidate.id,
        label: typeof candidate.label === 'string' && candidate.label.trim() ? candidate.label : getConnectionLabel(candidate.url),
        url: candidate.url,
        clientToken: typeof candidate.clientToken === 'string' && candidate.clientToken.trim() ? candidate.clientToken : undefined,
        lastUsedAt: typeof candidate.lastUsedAt === 'number' ? candidate.lastUsedAt : 0,
      }];
    }).sort((a, b) => b.lastUsedAt - a.lastUsedAt);
  } catch {
    return [];
  }
};

const saveMobileConnections = (connections: MobileSavedConnection[]): void => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(MOBILE_CONNECTIONS_STORAGE_KEY, JSON.stringify(connections.slice(0, 12)));
};

export const upsertMobileConnection = (connection: Omit<MobileSavedConnection, 'id' | 'lastUsedAt'>): MobileSavedConnection[] => {
  const connections = loadMobileConnections();
  const existing = connections.find((item) => item.url === connection.url);
  const nextConnection: MobileSavedConnection = {
    id: existing?.id || crypto.randomUUID(),
    ...connection,
    lastUsedAt: Date.now(),
  };
  const next = [nextConnection, ...connections.filter((item) => item.id !== nextConnection.id && item.url !== nextConnection.url)];
  saveMobileConnections(next);
  return next;
};

export const deleteMobileConnection = (id: string): MobileSavedConnection[] => {
  const next = loadMobileConnections().filter((connection) => connection.id !== id);
  saveMobileConnections(next);
  return next;
};

export const isSameConnectionUrl = (left: string, right: string): boolean => {
  try {
    return normalizeConnectionUrl(left) === normalizeConnectionUrl(right);
  } catch {
    return left.trim().replace(/\/+$/, '') === right.trim().replace(/\/+$/, '');
  }
};

export type UseMobileConnection = {
  connections: MobileSavedConnection[];
  isBusy: boolean;
  error: string | null;
  pendingConnection: MobilePendingConnection | null;
  connect: (input: MobileConnectInput) => Promise<void>;
  submitPassword: (password: string) => Promise<void>;
  cancelPassword: () => void;
  saveConnection: (input: MobileConnectInput) => MobileSavedConnection | null;
  removeConnection: (id: string) => MobileSavedConnection | null;
  setError: (message: string | null) => void;
};

// Shared connection controller. `onConnected` fires once the runtime endpoint is
// switched (the caller navigates away / closes its surface from there).
export const useMobileConnection = (onConnected: () => void): UseMobileConnection => {
  const { t } = useI18n();
  const [connections, setConnections] = React.useState<MobileSavedConnection[]>(() => loadMobileConnections());
  const [isBusy, setIsBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pendingConnection, setPendingConnection] = React.useState<MobilePendingConnection | null>(null);

  const connect = React.useCallback(async (input: MobileConnectInput) => {
    setError(null);
    setIsBusy(true);
    try {
      const normalizedUrl = normalizeConnectionUrl(input.url);
      if (!normalizedUrl) {
        setError(t('mobile.connect.error.urlRequired'));
        return;
      }

      const headers = input.clientToken ? { Authorization: `Bearer ${input.clientToken}` } : undefined;
      const health = await fetch(`${normalizedUrl}/health`, { method: 'GET', headers }).catch(() => null);
      if (!health || !health.ok) {
        setError(t('mobile.connect.error.unreachable'));
        return;
      }

      const label = input.label?.trim() || getConnectionLabel(normalizedUrl);
      const session = await fetch(`${normalizedUrl}/auth/session`, {
        method: 'GET',
        credentials: 'include',
        headers,
      }).catch(() => null);

      if (session?.status === 401 && !input.clientToken) {
        setPendingConnection({ label, url: normalizedUrl });
        setConnections(upsertMobileConnection({ label, url: normalizedUrl }));
        return;
      }

      if (!session || (!session.ok && session.status !== 404)) {
        setError(t('mobile.connect.error.authRequired'));
        return;
      }

      const clientToken = input.clientToken?.trim() || undefined;
      setConnections(upsertMobileConnection({ label, url: normalizedUrl, clientToken }));
      switchRuntimeEndpoint({ apiBaseUrl: normalizedUrl, clientToken: clientToken ?? null });
      onConnected();
    } catch {
      setError(t('mobile.connect.error.invalidUrl'));
    } finally {
      setIsBusy(false);
    }
  }, [onConnected, t]);

  const submitPassword = React.useCallback(async (password: string) => {
    if (!pendingConnection || !password.trim() || isBusy) return;
    setError(null);
    setIsBusy(true);
    try {
      const response = await fetch(`${pendingConnection.url}/auth/session`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          password,
          trustDevice: true,
          issueClientToken: true,
          clientLabel: 'OpenChamber Mobile',
        }),
      }).catch(() => null);

      if (!response?.ok) {
        setError(t('mobile.connect.error.passwordFailed'));
        return;
      }

      const payload = await response.json().catch(() => null) as { clientToken?: unknown } | null;
      const issuedToken = typeof payload?.clientToken === 'string' ? payload.clientToken.trim() : '';
      setConnections(upsertMobileConnection({ ...pendingConnection, clientToken: issuedToken || undefined }));
      setPendingConnection(null);
      switchRuntimeEndpoint({ apiBaseUrl: pendingConnection.url, clientToken: issuedToken || null });
      onConnected();
    } finally {
      setIsBusy(false);
    }
  }, [isBusy, onConnected, pendingConnection, t]);

  const cancelPassword = React.useCallback(() => {
    setPendingConnection(null);
    setError(null);
  }, []);

  const saveConnection = React.useCallback((input: MobileConnectInput): MobileSavedConnection | null => {
    setError(null);
    try {
      const normalizedUrl = normalizeConnectionUrl(input.url);
      if (!normalizedUrl) {
        setError(t('mobile.connect.error.urlRequired'));
        return null;
      }
      const next = upsertMobileConnection({
        label: input.label?.trim() || getConnectionLabel(normalizedUrl),
        url: normalizedUrl,
        clientToken: input.clientToken?.trim() || undefined,
      });
      setConnections(next);
      return next.find((connection) => connection.url === normalizedUrl) ?? null;
    } catch {
      setError(t('mobile.connect.error.invalidUrl'));
      return null;
    }
  }, [t]);

  const removeConnection = React.useCallback((id: string): MobileSavedConnection | null => {
    const removed = loadMobileConnections().find((connection) => connection.id === id) ?? null;
    setConnections(deleteMobileConnection(id));
    return removed;
  }, []);

  return {
    connections,
    isBusy,
    error,
    pendingConnection,
    connect,
    submitPassword,
    cancelPassword,
    saveConnection,
    removeConnection,
    setError,
  };
};
