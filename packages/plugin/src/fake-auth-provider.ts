import type { AuthProviderConfig } from "./auth-provider-types";

export const DEV_AUTH_PROVIDER_ID = "dev.fake-auth";

export interface FakeAuthProviderConfig {
  autoLogin?: boolean;
  delayMs?: number;
  label?: string;
}

function isDevEnvironment(): boolean {
  try {
    const g = globalThis as Record<string, unknown>;
    const proc = g.process as { env?: Record<string, string> } | undefined;
    return proc?.env?.NODE_ENV !== "production";
  } catch {
    return false;
  }
}

export function createFakeAuthProviderConfig(
  options: FakeAuthProviderConfig = {},
): AuthProviderConfig {
  const { autoLogin = false, label = "Dev Auth" } = options;

  return {
    id: DEV_AUTH_PROVIDER_ID,
    label,
    description: "Development-only auth provider (auto-login or click to sign in)",
    type: "custom",
    icon: "bug",
    priority: 100,
    enabled: isDevEnvironment(),
    supportsTrustDevice: false,
    isAvailable: isDevEnvironment,
    loginComponent: autoLogin ? undefined : undefined,
  };
}

export function isDevAuthProvider(id: string): boolean {
  return id === DEV_AUTH_PROVIDER_ID;
}
