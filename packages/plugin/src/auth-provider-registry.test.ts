import { describe, it, expect } from "vitest";
import { AuthProviderRegistry } from "./auth-provider-registry";

describe("AuthProviderRegistry", () => {
  it("registers and retrieves a provider", () => {
    const reg = new AuthProviderRegistry();
    reg.registerProvider({
      id: "test.password",
      label: "Password",
      type: "password",
    }, "test-plugin", "builtin");

    const provider = reg.getProvider("test.password");
    expect(provider).toBeDefined();
    expect(provider?.id).toBe("test.password");
    expect(provider?.label).toBe("Password");
    expect(provider?.type).toBe("password");
    expect(provider?.pluginId).toBe("test-plugin");
    expect(provider?.source).toBe("builtin");
  });

  it("throws on duplicate ID", () => {
    const reg = new AuthProviderRegistry();
    reg.registerProvider({
      id: "test.password",
      label: "Password",
      type: "password",
    }, "test-plugin", "builtin");

    expect(() => {
      reg.registerProvider({
        id: "test.password",
        label: "Duplicate Password",
        type: "password",
      }, "other-plugin", "user");
    }).toThrow(/Duplicate auth provider ID/);
  });

  it("returns all enabled providers sorted by priority then ID", () => {
    const reg = new AuthProviderRegistry();
    reg.registerProvider({
      id: "test.oauth",
      label: "OAuth",
      type: "oauth",
      priority: 10,
    }, "test-plugin", "builtin");
    reg.registerProvider({
      id: "test.password",
      label: "Password",
      type: "password",
      priority: 0,
    }, "test-plugin", "builtin");
    reg.registerProvider({
      id: "test.passkey",
      label: "Passkey",
      type: "passkey",
      priority: 0,
    }, "test-plugin", "builtin");

    const providers = reg.getAllProviders();
    expect(providers).toHaveLength(3);
    expect(providers[0].id).toBe("test.passkey");
    expect(providers[1].id).toBe("test.password");
    expect(providers[2].id).toBe("test.oauth");
  });

  it("filters out disabled providers", () => {
    const reg = new AuthProviderRegistry();
    reg.registerProvider({
      id: "test.password",
      label: "Password",
      type: "password",
    }, "test-plugin", "builtin");
    reg.registerProvider({
      id: "test.disabled",
      label: "Disabled",
      type: "sso",
      enabled: false,
    }, "test-plugin", "builtin");

    const providers = reg.getAllProviders();
    expect(providers).toHaveLength(1);
    expect(providers[0].id).toBe("test.password");
  });

  it("filters by availability", () => {
    const reg = new AuthProviderRegistry();
    reg.registerProvider({
      id: "test.available",
      label: "Available",
      type: "oauth",
      isAvailable: () => true,
    }, "test-plugin", "builtin");
    reg.registerProvider({
      id: "test.unavailable",
      label: "Unavailable",
      type: "sso",
      isAvailable: () => false,
    }, "test-plugin", "builtin");

    const available = reg.getAvailableProviders();
    expect(available).toHaveLength(1);
    expect(available[0].id).toBe("test.available");
  });

  it("returns descriptors without UI components", () => {
    const reg = new AuthProviderRegistry();
    reg.registerProvider({
      id: "test.password",
      label: "Password",
      type: "password",
      description: "Login with password",
      icon: "lock",
      priority: 5,
      supportsTrustDevice: true,
    }, "test-plugin", "builtin");

    const descriptors = reg.getDescriptors();
    expect(descriptors).toHaveLength(1);
    expect(descriptors[0]).toEqual({
      id: "test.password",
      label: "Password",
      description: "Login with password",
      type: "password",
      icon: "lock",
      priority: 5,
      supportsTrustDevice: true,
    });
  });

  it("returns snapshot with enabled count", () => {
    const reg = new AuthProviderRegistry();
    reg.registerProvider({
      id: "test.password",
      label: "Password",
      type: "password",
    }, "test-plugin", "builtin");
    reg.registerProvider({
      id: "test.disabled",
      label: "Disabled",
      type: "sso",
      enabled: false,
    }, "test-plugin", "builtin");

    const snapshot = reg.getSnapshot();
    expect(snapshot.enabledCount).toBe(1);
    expect(snapshot.providers).toHaveLength(1);
  });

  it("tracks contribution records", () => {
    const reg = new AuthProviderRegistry();
    reg.registerProvider({
      id: "test.password",
      label: "Password",
      type: "password",
    }, "test-plugin", "builtin");
    reg.registerProvider({
      id: "test.oauth",
      label: "OAuth",
      type: "oauth",
    }, "oauth-plugin", "user");

    const records = reg.getAllRecords();
    expect(records).toHaveLength(2);
    expect(records[0].id).toBe("test.password");
    expect(records[0].pluginId).toBe("test-plugin");
    expect(records[1].id).toBe("test.oauth");
    expect(records[1].pluginId).toBe("oauth-plugin");
    expect(reg.getContributionCount()).toBe(2);
  });

  it("checks if provider exists", () => {
    const reg = new AuthProviderRegistry();
    reg.registerProvider({
      id: "test.password",
      label: "Password",
      type: "password",
    }, "test-plugin", "builtin");

    expect(reg.hasProvider("test.password")).toBe(true);
    expect(reg.hasProvider("nonexistent")).toBe(false);
  });

  it("clears all providers", () => {
    const reg = new AuthProviderRegistry();
    reg.registerProvider({
      id: "test.password",
      label: "Password",
      type: "password",
    }, "test-plugin", "builtin");
    reg.registerProvider({
      id: "test.oauth",
      label: "OAuth",
      type: "oauth",
    }, "test-plugin", "builtin");

    reg.clear();
    expect(reg.getAllProviders()).toHaveLength(0);
    expect(reg.getContributionCount()).toBe(0);
    expect(reg.hasProvider("test.password")).toBe(false);
  });

  it("defaults enabled to true", () => {
    const reg = new AuthProviderRegistry();
    reg.registerProvider({
      id: "test.password",
      label: "Password",
      type: "password",
    }, "test-plugin", "builtin");

    const provider = reg.getProvider("test.password");
    expect(provider?.enabled).toBe(true);
  });

  it("defaults priority to 0", () => {
    const reg = new AuthProviderRegistry();
    reg.registerProvider({
      id: "test.password",
      label: "Password",
      type: "password",
    }, "test-plugin", "builtin");

    const provider = reg.getProvider("test.password");
    expect(provider?.priority).toBe(0);
  });

  it("defaults supportsTrustDevice to false", () => {
    const reg = new AuthProviderRegistry();
    reg.registerProvider({
      id: "test.password",
      label: "Password",
      type: "password",
    }, "test-plugin", "builtin");

    const provider = reg.getProvider("test.password");
    expect(provider?.supportsTrustDevice).toBe(false);
  });

  it("defaults isAvailable to always true", () => {
    const reg = new AuthProviderRegistry();
    reg.registerProvider({
      id: "test.password",
      label: "Password",
      type: "password",
    }, "test-plugin", "builtin");

    const provider = reg.getProvider("test.password");
    expect(provider?.isAvailable()).toBe(true);
  });
});
