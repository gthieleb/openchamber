export type AuthProviderType = "password" | "passkey" | "oauth" | "sso" | "custom";

export interface AuthProviderLoginProps {
  onSuccess: () => void;
  onError: (message: string) => void;
  isSubmitting: boolean;
}

export interface AuthProviderConfig {
  id: string;
  label: string;
  description?: string;
  type: AuthProviderType;
  icon?: string;
  priority?: number;
  enabled?: boolean;
  loginComponent?: React.ComponentType<AuthProviderLoginProps>;
  callbackComponent?: React.ComponentType<{ searchParams: URLSearchParams }>;
  supportsTrustDevice?: boolean;
  isAvailable?: () => boolean;
}

export interface AuthProviderContribution {
  id: string;
  label: string;
  description?: string;
  type: AuthProviderType;
  icon?: string;
  priority: number;
  enabled: boolean;
  loginComponent?: React.ComponentType<AuthProviderLoginProps>;
  callbackComponent?: React.ComponentType<{ searchParams: URLSearchParams }>;
  supportsTrustDevice: boolean;
  isAvailable: () => boolean;
  pluginId: string;
  source: string;
}

export interface AuthProviderContributionRecord {
  id: string;
  pluginId: string;
  source: string;
  type: AuthProviderType;
  enabled: boolean;
}

export interface AuthProviderSnapshot {
  providers: AuthProviderDescriptor[];
  enabledCount: number;
}

export interface AuthProviderDescriptor {
  id: string;
  label: string;
  description?: string;
  type: AuthProviderType;
  icon?: string;
  priority: number;
  supportsTrustDevice: boolean;
}
