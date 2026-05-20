import { describe, it, expect } from "vitest";
import { PluginStorageRegistry, getQuotaForScope } from "./plugin-storage-registry";

describe("PluginStorageRegistry", () => {
  it("registers and retrieves storage config", () => {
    const reg = new PluginStorageRegistry();
    reg.registerStorage("test-plugin", { scope: "global" }, "builtin");

    const config = reg.getStorageConfig("test-plugin");
    expect(config).toBeDefined();
    expect(config?.scope).toBe("global");
  });

  it("throws on duplicate storage registration", () => {
    const reg = new PluginStorageRegistry();
    reg.registerStorage("test-plugin", { scope: "global" }, "builtin");

    expect(() => {
      reg.registerStorage("test-plugin", { scope: "workspace" }, "builtin");
    }).toThrow(/Duplicate storage registration/);
  });

  it("registers and retrieves settings schema", () => {
    const reg = new PluginStorageRegistry();
    reg.registerSettingsSchema("test-plugin", {
      schema: { type: "object", properties: { enabled: { type: "boolean" } } },
      defaults: { enabled: true },
      version: 1,
    }, "builtin");

    const schema = reg.getSettingsSchema("test-plugin");
    expect(schema).toBeDefined();
    expect(schema?.version).toBe(1);
    expect(schema?.defaults).toEqual({ enabled: true });
  });

  it("throws on duplicate settings schema registration", () => {
    const reg = new PluginStorageRegistry();
    reg.registerSettingsSchema("test-plugin", {
      schema: { type: "object" },
    }, "builtin");

    expect(() => {
      reg.registerSettingsSchema("test-plugin", {
        schema: { type: "object" },
      }, "builtin");
    }).toThrow(/Duplicate settings schema registration/);
  });

  it("unregisters a plugin", () => {
    const reg = new PluginStorageRegistry();
    reg.registerStorage("test-plugin", { scope: "global" }, "builtin");
    reg.registerSettingsSchema("test-plugin", { schema: { type: "object" } }, "builtin");

    reg.unregisterPlugin("test-plugin");

    expect(reg.getStorageConfig("test-plugin")).toBeUndefined();
    expect(reg.getSettingsSchema("test-plugin")).toBeUndefined();
  });

  it("returns all storage configs sorted", () => {
    const reg = new PluginStorageRegistry();
    reg.registerStorage("user-plugin", { scope: "global" }, "user");
    reg.registerStorage("builtin-plugin", { scope: "workspace" }, "builtin");

    const configs = reg.getAllStorageConfigs();
    expect(configs).toHaveLength(2);
    expect(configs[0].pluginId).toBe("builtin-plugin");
    expect(configs[1].pluginId).toBe("user-plugin");
  });

  it("tracks contribution records", () => {
    const reg = new PluginStorageRegistry();
    reg.registerStorage("test-plugin", { scope: "global" }, "builtin");
    reg.registerSettingsSchema("test-plugin", { schema: { type: "object" } }, "builtin");

    const records = reg.getAllRecords();
    expect(records.storage).toHaveLength(1);
    expect(records.settingsSchemas).toHaveLength(1);
    expect(reg.getContributionCount()).toBe(2);
  });

  it("supports migration callback", () => {
    const reg = new PluginStorageRegistry();
    const migrateFn = (fromVersion: number, data: Record<string, unknown>) => {
      if (fromVersion === 1) {
        return { ...data, newField: true };
      }
      return data;
    };

    reg.registerSettingsSchema("test-plugin", {
      schema: { type: "object" },
      version: 2,
      migrate: migrateFn,
    }, "builtin");

    const schema = reg.getSettingsSchema("test-plugin");
    expect(schema?.migrate).toBe(migrateFn);
    expect(schema?.version).toBe(2);
  });
});

describe("getQuotaForScope", () => {
  it("returns global quota", () => {
    const quota = getQuotaForScope("global");
    expect(quota.maxEntries).toBe(1000);
    expect(quota.maxBytes).toBe(10 * 1024 * 1024);
  });

  it("returns workspace quota", () => {
    const quota = getQuotaForScope("workspace");
    expect(quota.maxEntries).toBe(500);
    expect(quota.maxBytes).toBe(5 * 1024 * 1024);
  });
});
