import { AuthProviderRegistry } from "@openchamber/plugin";

const authProviderRegistry = new AuthProviderRegistry();

function registerBuiltinProviders({ hasPassword, hasPasskeys }) {
  if (hasPassword) {
    authProviderRegistry.registerProvider({
      id: "builtin.password",
      label: "Password",
      description: "Sign in with your UI password",
      type: "password",
      icon: "lock",
      priority: 0,
      enabled: true,
      supportsTrustDevice: true,
    }, "openchamber", "builtin");
  }

  if (hasPasskeys) {
    authProviderRegistry.registerProvider({
      id: "builtin.passkey",
      label: "Passkey",
      description: "Sign in with a passkey",
      type: "passkey",
      icon: "lock-unlock",
      priority: 1,
      enabled: true,
      supportsTrustDevice: true,
    }, "openchamber", "builtin");
  }
}

function createAuthProviderRuntime() {
  return {
    getRegistry() {
      return authProviderRegistry;
    },

    registerProvider(config, pluginId, source) {
      authProviderRegistry.registerProvider(config, pluginId, source);
    },

    registerBuiltinProviders(options) {
      registerBuiltinProviders(options);
    },

    getProviderDescriptors() {
      return authProviderRegistry.getDescriptors();
    },

    getSnapshot() {
      return authProviderRegistry.getSnapshot();
    },

    handleProviderDiscovery(_req, res) {
      res.json(authProviderRegistry.getSnapshot());
    },

    isProviderEnabled(id) {
      const provider = authProviderRegistry.getProvider(id);
      return provider?.enabled === true && provider.isAvailable();
    },

    clear() {
      authProviderRegistry.clear();
    },
  };
}

export const authProviderRuntime = createAuthProviderRuntime();

export { createAuthProviderRuntime };
