import { describe, it, expect } from "vitest";
import { getServerPluginSettingsRegistry, createPluginSettingsAPI, getPluginSettingsSchema, getAllPluginSettingsSchemas, unregisterPluginSettings } from "./settings-registry.js";

describe("getServerPluginSettingsRegistry", () => {
  it("returns a singleton registry", () => {
    const reg1 = getServerPluginSettingsRegistry();
    const reg2 = getServerPluginSettingsRegistry();
    expect(reg1).toBe(reg2);
  });

  it("registers settings schema via API", () => {
    const api = createPluginSettingsAPI("test-plugin", "builtin");

    api.schema({
      schema: { type: "object", properties: { enabled: { type: "boolean" } } },
      defaults: { enabled: true },
      version: 1,
    });

    const schema = getPluginSettingsSchema("test-plugin");
    expect(schema).not.toBeNull();
    expect(schema?.version).toBe(1);
    expect(schema?.defaults).toEqual({ enabled: true });
  });

  it("throws on duplicate registration", () => {
    const api = createPluginSettingsAPI("dup-plugin", "builtin");

    api.schema({ schema: { type: "object" } });

    expect(() => {
      api.schema({ schema: { type: "object" } });
    }).toThrow(/Duplicate settings schema registration/);
  });

  it("supports migration callback", () => {
    const api = createPluginSettingsAPI("migrate-plugin", "builtin");

    const migrateFn = (fromVersion, data) => {
      if (fromVersion === 1) {
        return { ...data, migrated: true };
      }
      return data;
    };

    api.schema({
      schema: { type: "object" },
      version: 2,
      migrate: migrateFn,
    });

    const schema = getPluginSettingsSchema("migrate-plugin");
    expect(schema?.migrate).toBe(migrateFn);
  });

  it("returns all schemas", () => {
    const api1 = createPluginSettingsAPI("plugin-a", "builtin");
    const api2 = createPluginSettingsAPI("plugin-b", "builtin");

    api1.schema({ schema: { type: "object" } });
    api2.schema({ schema: { type: "object" } });

    const schemas = getAllPluginSettingsSchemas();
    expect(schemas.length).toBeGreaterThanOrEqual(2);
  });

  it("unregisters plugin settings", () => {
    const api = createPluginSettingsAPI("cleanup-plugin", "builtin");
    api.schema({ schema: { type: "object" } });

    unregisterPluginSettings("cleanup-plugin");

    const schema = getPluginSettingsSchema("cleanup-plugin");
    expect(schema).toBeNull();
  });
});
