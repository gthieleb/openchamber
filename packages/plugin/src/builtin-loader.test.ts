import { describe, it, expect } from "vitest";
import { loadBuiltinPlugins, getBuiltinDiagnostics } from "./builtin-loader";
import { definePlugin } from "./types";
import type { BuiltinPluginEntry, BuiltinLoaderConfig } from "./builtin-loader";
import type { PluginTarget } from "./types";

function createTestConfig(overrides?: Partial<BuiltinLoaderConfig>): BuiltinLoaderConfig {
  return {
    target: "ui",
    createUIAPI: () => ({
      fill: () => {},
      surface: () => {},
      slot: () => {},
      replace: () => {},
      wrap: () => {},
    }),
    createCommandsAPI: () => ({
      register: () => {},
    }),
    createSettingsAPI: () => ({
      page: () => {},
      section: () => {},
    }),
    createStorageAPI: () => ({
      get: () => undefined,
      set: () => {},
      delete: () => {},
    }),
    createToolsAPI: () => ({
      registerRenderer: () => {},
    }),
    createModelsAPI: () => ({
      filter: () => {},
      decorate: () => {},
    }),
    createRuntimeAPI: (target: PluginTarget) => ({
      target,
      isRuntime: (t: PluginTarget) => t === target,
    }),
    ...overrides,
  };
}

describe("loadBuiltinPlugins", () => {
  describe("basic loading", () => {
    it("loads enabled built-in plugins", async () => {
      const plugins: BuiltinPluginEntry[] = [
        {
          definition: {
            id: "test.plugin",
            name: "Test",
            version: "1.0.0",
            setup: () => {},
          },
        },
      ];

      const result = await loadBuiltinPlugins(plugins, createTestConfig());

      expect(result.plugins).toHaveLength(1);
      expect(result.plugins[0].status).toBe("ready");
      expect(result.plugins[0].pluginId).toBe("test.plugin");
    });

    it("loads plugins using definePlugin helper", async () => {
      const plugins: BuiltinPluginEntry[] = [
        {
          definition: definePlugin({
            id: "test.defined",
            name: "Defined",
            version: "1.0.0",
            setup: () => {},
          }),
        },
      ];

      const result = await loadBuiltinPlugins(plugins, createTestConfig());

      expect(result.plugins).toHaveLength(1);
      expect(result.plugins[0].status).toBe("ready");
    });

    it("loads plugins in priority order", async () => {
      const order: string[] = [];
      const plugins: BuiltinPluginEntry[] = [
        {
          definition: {
            id: "test.high",
            name: "High",
            version: "1.0.0",
            priority: 100,
            setup: () => { order.push("high"); },
          },
        },
        {
          definition: {
            id: "test.low",
            name: "Low",
            version: "1.0.0",
            priority: 10,
            setup: () => { order.push("low"); },
          },
        },
        {
          definition: {
            id: "test.mid",
            name: "Mid",
            version: "1.0.0",
            priority: 50,
            setup: () => { order.push("mid"); },
          },
        },
      ];

      await loadBuiltinPlugins(plugins, createTestConfig());

      expect(order).toEqual(["low", "mid", "high"]);
    });
  });

  describe("enablement", () => {
    it("respects enabledByDefault: false", async () => {
      const plugins: BuiltinPluginEntry[] = [
        {
          definition: {
            id: "test.disabled",
            name: "Disabled",
            version: "1.0.0",
            enabledByDefault: false,
            setup: () => {},
          },
        },
      ];

      const result = await loadBuiltinPlugins(plugins, createTestConfig());

      expect(result.plugins[0].status).toBe("disabled");
    });

    it("respects disabledPlugins set", async () => {
      const plugins: BuiltinPluginEntry[] = [
        {
          definition: {
            id: "test.plugin",
            name: "Plugin",
            version: "1.0.0",
            setup: () => {},
          },
        },
      ];

      const result = await loadBuiltinPlugins(plugins, createTestConfig({
        disabledPlugins: new Set(["test.plugin"]),
      }));

      expect(result.plugins[0].status).toBe("disabled");
    });

    it("respects enabledPlugins allowlist", async () => {
      const plugins: BuiltinPluginEntry[] = [
        {
          definition: {
            id: "test.allowed",
            name: "Allowed",
            version: "1.0.0",
            setup: () => {},
          },
        },
        {
          definition: {
            id: "test.blocked",
            name: "Blocked",
            version: "1.0.0",
            setup: () => {},
          },
        },
      ];

      const result = await loadBuiltinPlugins(plugins, createTestConfig({
        enabledPlugins: new Set(["test.allowed"]),
      }));

      expect(result.plugins.find((p) => p.pluginId === "test.allowed")?.status).toBe("ready");
      expect(result.plugins.find((p) => p.pluginId === "test.blocked")?.status).toBe("disabled");
    });
  });

  describe("target filtering", () => {
    it("skips plugins that do not support the current target", async () => {
      const plugins: BuiltinPluginEntry[] = [
        {
          definition: {
            id: "test.server-only",
            name: "Server Only",
            version: "1.0.0",
            targets: ["server"],
            setup: () => {},
          },
        },
        {
          definition: {
            id: "test.ui-only",
            name: "UI Only",
            version: "1.0.0",
            targets: ["ui"],
            setup: () => {},
          },
        },
      ];

      const result = await loadBuiltinPlugins(plugins, createTestConfig({
        target: "ui",
      }));

      const serverPlugin = result.plugins.find((p) => p.pluginId === "test.server-only");
      const uiPlugin = result.plugins.find((p) => p.pluginId === "test.ui-only");

      expect(serverPlugin?.status).toBe("skipped");
      expect(uiPlugin?.status).toBe("ready");
    });
  });

  describe("capabilities", () => {
    it("grants declared capabilities", async () => {
      let grantedCaps: string[] = [];

      const plugins: BuiltinPluginEntry[] = [
        {
          definition: {
            id: "test.caps",
            name: "Caps",
            version: "1.0.0",
            capabilities: ["ui.fill", "ui.surface"],
            optionalCapabilities: ["storage.global"],
            setup: (ctx) => {
              grantedCaps = [...ctx.capabilities.granted];
            },
          },
        },
      ];

      await loadBuiltinPlugins(plugins, createTestConfig());

      expect(grantedCaps).toContain("ui.fill");
      expect(grantedCaps).toContain("ui.surface");
      expect(grantedCaps).toContain("storage.global");
    });
  });

  describe("error handling", () => {
    it("records setup errors for non-required plugins", async () => {
      const plugins: BuiltinPluginEntry[] = [
        {
          definition: {
            id: "test.failing",
            name: "Failing",
            version: "1.0.0",
            setup: () => { throw new Error("setup failed"); },
          },
        },
      ];

      const result = await loadBuiltinPlugins(plugins, createTestConfig());

      expect(result.plugins[0].status).toBe("error");
      expect(result.plugins[0].error).toBe("setup failed");
      expect(result.errors).toHaveLength(1);
    });

    it("throws for required plugins that fail", async () => {
      const plugins: BuiltinPluginEntry[] = [
        {
          definition: {
            id: "test.required",
            name: "Required",
            version: "1.0.0",
            required: true,
            setup: () => { throw new Error("required failed"); },
          },
        },
      ];

      await expect(
        loadBuiltinPlugins(plugins, createTestConfig()),
      ).rejects.toThrow("required failed");
    });
  });

  describe("server target", () => {
    it("provides server API when target is server", async () => {
      let hasServer = false;

      const plugins: BuiltinPluginEntry[] = [
        {
          definition: {
            id: "test.server",
            name: "Server",
            version: "1.0.0",
            targets: ["server"],
            setup: (ctx) => {
              hasServer = ctx.server !== undefined;
            },
          },
        },
      ];

      await loadBuiltinPlugins(plugins, createTestConfig({
        target: "server",
        createServerAPI: () => ({
          routes: () => {},
          middleware: () => {},
          lifecycle: () => {},
        }),
      }));

      expect(hasServer).toBe(true);
    });

    it("does not provide server API when target is ui", async () => {
      let hasServer = true;

      const plugins: BuiltinPluginEntry[] = [
        {
          definition: {
            id: "test.ui",
            name: "UI",
            version: "1.0.0",
            targets: ["ui"],
            setup: (ctx) => {
              hasServer = ctx.server !== undefined;
            },
          },
        },
      ];

      await loadBuiltinPlugins(plugins, createTestConfig({
        target: "ui",
      }));

      expect(hasServer).toBe(false);
    });
  });

  describe("diagnostics", () => {
    it("generates diagnostics from loader result", async () => {
      const plugins: BuiltinPluginEntry[] = [
        {
          definition: {
            id: "test.diag",
            name: "Diagnostic",
            version: "1.0.0",
            setup: () => {},
          },
        },
      ];

      const result = await loadBuiltinPlugins(plugins, createTestConfig());
      const diagnostics = getBuiltinDiagnostics(result);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].id).toBe("test.diag");
      expect(diagnostics[0].status).toBe("ready");
      expect(diagnostics[0].source).toBe("builtin");
    });

    it("includes errors in diagnostics", async () => {
      const plugins: BuiltinPluginEntry[] = [
        {
          definition: {
            id: "test.error",
            name: "Error",
            version: "1.0.0",
            setup: () => { throw new Error("boom"); },
          },
        },
      ];

      const result = await loadBuiltinPlugins(plugins, createTestConfig());
      const diagnostics = getBuiltinDiagnostics(result);

      expect(diagnostics[0].status).toBe("error");
      expect(diagnostics[0].setupErrors).toContain('Plugin "test.error" setup failed: boom');
    });
  });
});
