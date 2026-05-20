import React from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Icon } from '@/components/icon/Icon';
import { useI18n } from '@/lib/i18n';
import type { AuthProviderDescriptor } from '@openchamber/plugin';
import type { PasskeyStatus } from '@/lib/passkeys';

interface PasswordProviderLoginProps {
  isSubmitting: boolean;
  isPasskeyBusy: boolean;
  activePasskeyAction: 'auth' | 'register' | null;
  onPasskeyAuth: () => Promise<void>;
  passkeyStatus: PasskeyStatus;
  supportsPasskeys: boolean;
  trustDevice: boolean;
  onTrustDeviceChange: (value: boolean) => void;
  errorMessage: string;
  onClearError: () => void;
  passwordInputRef: React.RefObject<HTMLInputElement | null>;
}

export const PasswordProviderLogin: React.FC<PasswordProviderLoginProps> = ({
  isSubmitting,
  isPasskeyBusy,
  activePasskeyAction,
  onPasskeyAuth,
  passkeyStatus,
  supportsPasskeys,
  trustDevice,
  onTrustDeviceChange,
  errorMessage,
  onClearError,
  passwordInputRef,
}) => {
  const { t } = useI18n();
  const [password, setPassword] = React.useState('');

  const canOfferPasskeySetup = supportsPasskeys && passkeyStatus.enabled;
  const canUsePasskey = canOfferPasskeySetup && passkeyStatus.hasPasskeys;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
  };

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-2">
      {canUsePasskey && (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => void onPasskeyAuth()}
          disabled={isSubmitting || (isPasskeyBusy && activePasskeyAction !== 'auth')}
        >
          {isPasskeyBusy ? (
            <Icon name="loader-4" className="h-4 w-4 animate-spin" />
          ) : (
            <Icon name="lock-unlock" className="h-4 w-4" />
          )}
          <span>{isPasskeyBusy && activePasskeyAction === 'auth'
            ? t('sessionAuth.actions.cancelPasskey')
            : t('sessionAuth.actions.usePasskey')}</span>
        </Button>
      )}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Icon name="lock" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
          <Input
            id="openchamber-ui-password"
            ref={passwordInputRef}
            type="password"
            autoComplete="current-password"
            placeholder={t('sessionAuth.password.placeholder')}
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              if (errorMessage) onClearError();
            }}
            className="pl-10"
            aria-invalid={Boolean(errorMessage) || undefined}
            aria-describedby={errorMessage ? 'oc-ui-auth-error' : undefined}
            disabled={isSubmitting}
          />
        </div>
        <Button
          type="submit"
          size="icon"
          disabled={!password || isSubmitting}
          aria-label={isSubmitting ? t('sessionAuth.actions.unlockingAria') : t('sessionAuth.actions.unlockAria')}
        >
          {isSubmitting ? (
            <Icon name="loader-4" className="h-4 w-4 animate-spin" />
          ) : (
            <Icon name="lock-unlock" className="h-4 w-4" />
          )}
        </Button>
      </div>
      {canOfferPasskeySetup ? (
        <div className="flex items-center justify-between pt-1">
          <label className="flex items-center gap-2 text-center typography-micro text-muted-foreground">
            <Checkbox
              checked={trustDevice}
              onChange={onTrustDeviceChange}
              disabled={isSubmitting}
              ariaLabel={t('sessionAuth.actions.trustDeviceAria')}
              className="size-4"
              iconClassName="size-4"
            />
            <span>{t('sessionAuth.actions.trustDevice')}</span>
          </label>
        </div>
      ) : (
        <label className="flex items-center justify-center gap-2 pt-1 text-center typography-micro text-muted-foreground">
          <Checkbox
            checked={trustDevice}
            onChange={onTrustDeviceChange}
            disabled={isSubmitting}
            ariaLabel={t('sessionAuth.actions.trustDeviceAria')}
            className="size-4"
            iconClassName="size-4"
          />
          <span>{t('sessionAuth.actions.trustDevice')}</span>
        </label>
      )}
      {errorMessage && (
        <p id="oc-ui-auth-error" className="typography-meta text-destructive">
          {errorMessage}
        </p>
      )}
    </form>
  );
};

interface GenericProviderButtonProps {
  provider: AuthProviderDescriptor;
  isSubmitting: boolean;
  onLogin: () => void;
}

export const GenericProviderButton: React.FC<GenericProviderButtonProps> = ({
  provider,
  isSubmitting,
  onLogin,
}) => (
  <Button
    type="button"
    variant="outline"
    className="w-full"
    onClick={onLogin}
    disabled={isSubmitting}
  >
    {provider.icon ? (
      <Icon name={provider.icon as string} className="h-4 w-4" />
    ) : (
      <Icon name="login" className="h-4 w-4" />
    )}
    <span>{provider.label}</span>
  </Button>
);

interface ProviderLoginAreaProps {
  providers: AuthProviderDescriptor[];
  isSubmitting: boolean;
  isPasskeyBusy: boolean;
  activePasskeyAction: 'auth' | 'register' | null;
  onPasswordSubmit: (password: string, trustDevice: boolean, enrollPasskey: boolean) => Promise<void>;
  onPasskeyAuth: () => Promise<void>;
  onPasskeySetup: () => Promise<void>;
  onProviderLogin: (providerId: string) => void;
  passkeyStatus: PasskeyStatus;
  supportsPasskeys: boolean;
  trustDevice: boolean;
  onTrustDeviceChange: (value: boolean) => void;
  errorMessage: string;
  onClearError: () => void;
  passwordInputRef: React.RefObject<HTMLInputElement | null>;
}

export const ProviderLoginArea: React.FC<ProviderLoginAreaProps> = ({
  providers,
  isSubmitting,
  isPasskeyBusy,
  activePasskeyAction,
  onPasskeyAuth,
  onProviderLogin,
  passkeyStatus,
  supportsPasskeys,
  trustDevice,
  onTrustDeviceChange,
  errorMessage,
  onClearError,
  passwordInputRef,
}) => {
  const passwordProvider = providers.find((p) => p.type === 'password');
  const passkeyProvider = providers.find((p) => p.type === 'passkey');
  const otherProviders = providers.filter((p) => p.type !== 'password' && p.type !== 'passkey');

  return (
    <div className="w-full space-y-3">
      {otherProviders.length > 0 && (
        <div className="space-y-2">
          {otherProviders.map((provider) => (
            <GenericProviderButton
              key={provider.id}
              provider={provider}
              isSubmitting={isSubmitting}
              onLogin={() => void onProviderLogin(provider.id)}
            />
          ))}
        </div>
      )}

      {passkeyProvider && !passwordProvider && (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => void onPasskeyAuth()}
          disabled={isSubmitting || (isPasskeyBusy && activePasskeyAction !== 'auth')}
        >
          {isPasskeyBusy ? (
            <Icon name="loader-4" className="h-4 w-4 animate-spin" />
          ) : (
            <Icon name={passkeyProvider.icon ?? 'lock-unlock'} className="h-4 w-4" />
          )}
          <span>{passkeyProvider.label}</span>
        </Button>
      )}

      {passwordProvider && (
        <PasswordProviderLogin
          isSubmitting={isSubmitting}
          isPasskeyBusy={isPasskeyBusy}
          activePasskeyAction={activePasskeyAction}
          onPasskeyAuth={onPasskeyAuth}
          passkeyStatus={passkeyStatus}
          supportsPasskeys={supportsPasskeys}
          trustDevice={trustDevice}
          onTrustDeviceChange={onTrustDeviceChange}
          errorMessage={errorMessage}
          onClearError={onClearError}
          passwordInputRef={passwordInputRef}
        />
      )}
    </div>
  );
};
