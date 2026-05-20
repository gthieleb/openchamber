import React from 'react';
import { browserSupportsWebAuthn } from '@simplewebauthn/browser';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui';
import { isDesktopShell, isVSCodeRuntime } from '@/lib/desktop';
import { syncDesktopSettings, initializeAppearancePreferences } from '@/lib/persistence';
import { applyPersistedDirectoryPreferences } from '@/lib/directoryPersistence';
import { DesktopHostSwitcherInline } from '@/components/desktop/DesktopHostSwitcher';
import { OpenChamberLogo } from '@/components/ui/OpenChamberLogo';
import { Icon } from "@/components/icon/Icon";
import { useI18n } from '@/lib/i18n';
import {
  authenticateWithPasskey,
  cancelPasskeyCeremony,
  defaultPasskeyStatus,
  fetchPasskeyStatus,
  isPasskeyCeremonyAbort,
  type PasskeyStatus,
  registerCurrentDevicePasskey,
} from '@/lib/passkeys';
import type { AuthProviderDescriptor } from '@openchamber/plugin';
import { ProviderLoginArea } from './ProviderLoginArea';

const STATUS_CHECK_ENDPOINT = '/auth/session';
const PROVIDERS_ENDPOINT = '/api/auth/providers';
const TRUST_DEVICE_STORAGE_KEY = 'openchamber.uiAuth.trustDevice';

const fetchSessionStatus = async (): Promise<Response> => {
  const response = await fetch(STATUS_CHECK_ENDPOINT, {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  return response;
};

const fetchAuthProviderProviders = async (): Promise<AuthProviderDescriptor[]> => {
  try {
    const response = await fetch(PROVIDERS_ENDPOINT, {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return [];
    const data = await response.json();
    return data.providers ?? [];
  } catch {
    return [];
  }
};

const readStoredTrustDevice = (): boolean => {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(TRUST_DEVICE_STORAGE_KEY) === 'true';
};

const AuthShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background text-foreground"
    style={{ fontFamily: '"Inter", "SF Pro Text", -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", sans-serif' }}
  >
    <div
      className="pointer-events-none absolute inset-0 opacity-55"
      style={{
        background: 'radial-gradient(120% 140% at 50% -20%, var(--surface-overlay) 0%, transparent 68%)',
      }}
    />
    <div
      className="pointer-events-none absolute inset-0"
      style={{ backgroundColor: 'var(--surface-subtle)', opacity: 0.22 }}
    />
    <div className="relative z-10 flex w-full justify-center px-4 py-12 sm:px-6">
      {children}
    </div>
  </div>
);

const LoadingScreen: React.FC = () => (
  <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
    <OpenChamberLogo width={120} height={120} />
  </div>
);

const ErrorScreen: React.FC<{ onRetry: () => void; errorType?: 'network' | 'rate-limit'; retryAfter?: number }> = ({ onRetry, errorType = 'network', retryAfter }) => {
  const { t } = useI18n();
  const isRateLimit = errorType === 'rate-limit';
  const minutes = retryAfter ? Math.ceil(retryAfter / 60) : 1;

  return (
    <AuthShell>
      <div className="flex flex-col items-center gap-6 text-center">
        <div className="space-y-2">
          <h1 className="typography-ui-header font-semibold text-destructive">
            {isRateLimit ? t('sessionAuth.error.rateLimitTitle') : t('sessionAuth.error.networkTitle')}
          </h1>
          <p className="typography-meta text-muted-foreground max-w-xs">
            {isRateLimit
              ? (minutes > 1
                ? t('sessionAuth.error.rateLimitDescriptionPlural', { minutes })
                : t('sessionAuth.error.rateLimitDescriptionSingle', { minutes }))
              : t('sessionAuth.error.networkDescription')}
          </p>
        </div>
        <Button type="button" onClick={onRetry} className="w-full max-w-xs">
          {t('sessionAuth.error.retry')}
        </Button>
      </div>
    </AuthShell>
  );
};

interface SessionAuthGateProps {
  children: React.ReactNode;
}

type GateState = 'pending' | 'authenticated' | 'locked' | 'error' | 'rate-limited';

export const SessionAuthGate: React.FC<SessionAuthGateProps> = ({ children }) => {
  const { t } = useI18n();
  const vscodeRuntime = React.useMemo(() => isVSCodeRuntime(), []);
  const skipAuth = vscodeRuntime;
  const showHostSwitcher = React.useMemo(() => isDesktopShell() && !vscodeRuntime, [vscodeRuntime]);
  const [state, setState] = React.useState<GateState>(() => (skipAuth ? 'authenticated' : 'pending'));
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState('');
  const [retryAfter, setRetryAfter] = React.useState<number | undefined>(undefined);
  const [isTunnelLocked, setIsTunnelLocked] = React.useState(false);
  const [passkeyStatus, setPasskeyStatus] = React.useState<PasskeyStatus>(defaultPasskeyStatus);
  const [supportsPasskeys, setSupportsPasskeys] = React.useState(false);
  const [isPasskeyBusy, setIsPasskeyBusy] = React.useState(false);
  const [trustDevice, setTrustDevice] = React.useState<boolean>(() => readStoredTrustDevice());
  const [activePasskeyAction, setActivePasskeyAction] = React.useState<'auth' | 'register' | null>(null);
  const [providers, setProviders] = React.useState<AuthProviderDescriptor[]>([]);
  const passwordInputRef = React.useRef<HTMLInputElement | null>(null);
  const hasResyncedRef = React.useRef(skipAuth);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(TRUST_DEVICE_STORAGE_KEY, trustDevice ? 'true' : 'false');
  }, [trustDevice]);

  React.useEffect(() => {
    if (skipAuth) return;
    void fetchAuthProviderProviders().then(setProviders);
  }, [skipAuth]);

  const refreshPasskeyStatus = React.useCallback(async () => {
    if (skipAuth) return defaultPasskeyStatus;
    try {
      const nextStatus = await fetchPasskeyStatus();
      setPasskeyStatus(nextStatus);
      return nextStatus;
    } catch {
      setPasskeyStatus(defaultPasskeyStatus);
      return defaultPasskeyStatus;
    }
  }, [skipAuth]);

  React.useEffect(() => {
    let cancelled = false;
    if (skipAuth) return;
    void (async () => {
      try {
        if (!window.isSecureContext || !browserSupportsWebAuthn()) {
          if (!cancelled) setSupportsPasskeys(false);
          return;
        }
        if (!cancelled) setSupportsPasskeys(true);
      } catch {
        if (!cancelled) setSupportsPasskeys(false);
      }
    })();
    return () => { cancelled = true; };
  }, [skipAuth]);

  const checkStatus = React.useCallback(async () => {
    if (skipAuth) { setState('authenticated'); return; }
    setState((prev) => (prev === 'authenticated' ? prev : 'pending'));
    try {
      const [response, latestPasskeyStatus] = await Promise.all([
        fetchSessionStatus(),
        refreshPasskeyStatus(),
      ]);
      const responseText = await response.text();
      if (response.ok) {
        setState('authenticated');
        setIsTunnelLocked(false);
        setErrorMessage('');
        setRetryAfter(undefined);
        return;
      }
      if (response.status === 401) {
        let data: { tunnelLocked?: boolean } = {};
        try { data = JSON.parse(responseText); } catch { data = {}; }
        setIsTunnelLocked(data.tunnelLocked === true);
        setPasskeyStatus(latestPasskeyStatus);
        setState('locked');
        setRetryAfter(undefined);
        return;
      }
      if (response.status === 429) {
        let data: { retryAfter?: number } = {};
        try { data = JSON.parse(responseText); } catch { data = {}; }
        setRetryAfter(data.retryAfter);
        setIsTunnelLocked(false);
        setState('rate-limited');
        return;
      }
      setState('error');
      setIsTunnelLocked(false);
    } catch (error) {
      console.warn('Failed to check session status:', error);
      setState('error');
      setIsTunnelLocked(false);
    }
  }, [refreshPasskeyStatus, skipAuth]);

  React.useEffect(() => {
    if (skipAuth) return;
    void checkStatus();
  }, [checkStatus, skipAuth]);

  React.useEffect(() => {
    if (!skipAuth && state === 'locked') hasResyncedRef.current = false;
  }, [skipAuth, state]);

  React.useEffect(() => {
    if (state === 'locked' && passwordInputRef.current) {
      passwordInputRef.current.focus();
      passwordInputRef.current.select();
    }
  }, [state]);

  React.useEffect(() => {
    if (skipAuth) return;
    if (state === 'authenticated' && !hasResyncedRef.current) {
      hasResyncedRef.current = true;
      void (async () => {
        await syncDesktopSettings();
        await initializeAppearancePreferences();
        await applyPersistedDirectoryPreferences();
      })();
    }
  }, [skipAuth, state]);

  const registerPasskeyForCurrentSession = React.useCallback(async () => {
    setActivePasskeyAction('register');
    setIsPasskeyBusy(true);
    try { await registerCurrentDevicePasskey(); }
    finally { setActivePasskeyAction(null); setIsPasskeyBusy(false); }
    await refreshPasskeyStatus();
  }, [refreshPasskeyStatus]);

  const cancelActivePasskey = React.useCallback(() => {
    cancelPasskeyCeremony();
    setActivePasskeyAction(null);
    setIsPasskeyBusy(false);
  }, []);

  const handlePasswordSubmit = React.useCallback(async (password: string, trustDeviceValue: boolean, enrollPasskey: boolean) => {
    if (isTunnelLocked) return;
    if (!password || isSubmitting) return;
    if (isPasskeyBusy) cancelActivePasskey();

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const response = await fetch(STATUS_CHECK_ENDPOINT, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ password, trustDevice: trustDeviceValue }),
      });
      if (response.ok) {
        setIsTunnelLocked(false);
        if (enrollPasskey && supportsPasskeys) {
          try {
            await registerPasskeyForCurrentSession();
            toast.success(t('sessionAuth.toast.passkeyAdded'));
            setState('authenticated');
            return;
          } catch (error) {
            if (isPasskeyCeremonyAbort(error)) {
              toast.message(t('sessionAuth.toast.passkeySetupCanceled'));
            } else {
              toast.error(error instanceof Error ? error.message : t('sessionAuth.error.passkeySetupFailed'));
            }
            setState('authenticated');
            return;
          }
        }
        setState('authenticated');
        return;
      }
      if (response.status === 401) {
        setErrorMessage(t('sessionAuth.error.incorrectPassword'));
        setIsTunnelLocked(false);
        setState('locked');
        return;
      }
      if (response.status === 429) {
        const data = await response.json().catch(() => ({}));
        setRetryAfter(data.retryAfter);
        setIsTunnelLocked(false);
        setState('rate-limited');
        return;
      }
      setErrorMessage(t('sessionAuth.error.unexpectedResponse'));
      setIsTunnelLocked(false);
      setState('error');
    } catch (error) {
      console.warn('Failed to submit UI password:', error);
      setErrorMessage(t('sessionAuth.error.networkRetry'));
      setIsTunnelLocked(false);
      setState('error');
    } finally {
      setIsSubmitting(false);
    }
  }, [cancelActivePasskey, isPasskeyBusy, isSubmitting, isTunnelLocked, registerPasskeyForCurrentSession, supportsPasskeys, t]);

  const handlePasskeyUnlock = React.useCallback(async () => {
    if (isSubmitting || !supportsPasskeys) return;
    if (isPasskeyBusy) { cancelActivePasskey(); return; }
    setIsPasskeyBusy(true);
    setActivePasskeyAction('auth');
    setErrorMessage('');
    try {
      await authenticateWithPasskey(trustDevice);
      setState('authenticated');
    } catch (error) {
      if (isPasskeyCeremonyAbort(error)) {
        setErrorMessage('');
      } else {
        setErrorMessage(error instanceof Error ? error.message : t('sessionAuth.error.passkeySignInCanceled'));
      }
    } finally {
      setActivePasskeyAction(null);
      setIsPasskeyBusy(false);
    }
  }, [cancelActivePasskey, isPasskeyBusy, isSubmitting, supportsPasskeys, t, trustDevice]);

  const handlePasskeySetupOnly = React.useCallback(async () => {
    if (isSubmitting || isTunnelLocked || !supportsPasskeys) return;
    if (isPasskeyBusy) { cancelActivePasskey(); return; }
    setErrorMessage('');
    try {
      await registerPasskeyForCurrentSession();
      toast.success(t('sessionAuth.toast.passkeyAdded'));
    } catch (error) {
      if (isPasskeyCeremonyAbort(error)) {
        toast.message(t('sessionAuth.toast.passkeySetupCanceled'));
        return;
      }
      toast.error(error instanceof Error ? error.message : t('sessionAuth.error.passkeySetupFailed'));
    }
  }, [cancelActivePasskey, isPasskeyBusy, isSubmitting, isTunnelLocked, registerPasskeyForCurrentSession, t]);

  const handleProviderLogin = React.useCallback((_providerId: string) => {
    console.warn(`Provider login not yet implemented for: ${_providerId}`);
  }, []);

  if (state === 'pending') return <LoadingScreen />;
  if (state === 'error') return <ErrorScreen onRetry={() => void checkStatus()} errorType="network" />;
  if (state === 'rate-limited') return <ErrorScreen onRetry={() => void checkStatus()} errorType="rate-limit" retryAfter={retryAfter} />;

  if (state === 'locked') {
    const hasAnyProvider = providers.length > 0;

    return (
      <AuthShell>
        <div className="flex flex-col items-center gap-6 w-full max-w-xs">
          <div className="flex flex-col items-center gap-1 text-center">
            <h1 className="text-xl font-semibold text-foreground">
              {isTunnelLocked ? t('sessionAuth.locked.tunnelTitle') : t('sessionAuth.locked.unlockTitle')}
            </h1>
            <p className="typography-meta text-muted-foreground">
              {isTunnelLocked
                ? t('sessionAuth.locked.tunnelDescription')
                : t('sessionAuth.locked.passwordDescription')}
            </p>
          </div>

          {!isTunnelLocked && hasAnyProvider && (
            <ProviderLoginArea
              providers={providers}
              isSubmitting={isSubmitting}
              isPasskeyBusy={isPasskeyBusy}
              activePasskeyAction={activePasskeyAction}
              onPasswordSubmit={handlePasswordSubmit}
              onPasskeyAuth={handlePasskeyUnlock}
              onPasskeySetup={handlePasskeySetupOnly}
              onProviderLogin={handleProviderLogin}
              passkeyStatus={passkeyStatus}
              supportsPasskeys={supportsPasskeys}
              trustDevice={trustDevice}
              onTrustDeviceChange={setTrustDevice}
              errorMessage={errorMessage}
              onClearError={() => setErrorMessage('')}
              passwordInputRef={passwordInputRef}
            />
          )}

          {!isTunnelLocked && !hasAnyProvider && (
            <div className="w-full space-y-2">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Icon name="lock" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                  <Input
                    id="openchamber-ui-password"
                    ref={passwordInputRef}
                    type="password"
                    autoComplete="current-password"
                    placeholder={t('sessionAuth.password.placeholder')}
                    className="pl-10"
                    disabled={isSubmitting}
                  />
                </div>
                <Button
                  type="submit"
                  size="icon"
                  disabled={isSubmitting}
                  aria-label={isSubmitting ? t('sessionAuth.actions.unlockingAria') : t('sessionAuth.actions.unlockAria')}
                >
                  {isSubmitting ? (
                    <Icon name="loader-4" className="h-4 w-4 animate-spin" />
                  ) : (
                    <Icon name="lock-unlock" className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          )}

          {showHostSwitcher && (
            <div className="w-full">
              <DesktopHostSwitcherInline />
              <p className="mt-1 text-center typography-micro text-muted-foreground">
                {t('sessionAuth.locked.hostSwitcherHint')}
              </p>
            </div>
          )}
        </div>
      </AuthShell>
    );
  }

  return <>{children}</>;
};
