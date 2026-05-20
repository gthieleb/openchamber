import { describe, it, expect, vi } from "vitest";
import { createBuiltinServerLoader, BUILTIN_SERVER_PLUGINS } from "./builtin-loader.js";
import { TERMINAL_PLUGIN_ID, TERMINAL_FEATURE_ID } from "@openchamber/plugin-terminal";

describe("createBuiltinServerLoader", () => {
  describe("basic loading", () => {
    it("loads built-in server plugins", async () => {
      const loader = createBuiltinServerLoader();
      const result = await loader.load();

      expect(result.results.length).toBeGreaterThan(0);
      expect(result.results[0].status).toBe("ready");
    });

    it("registers routes from built-in plugins", async () => {
      const loader = createBuiltinServerLoader();
      const result = await loader.load();

      const serverRegistry = result.serverRegistry;
      const contributions = serverRegistry.getAllContributions();

      expect(contributions.length).toBeGreaterThan(0);
    });
  });

  describe("terminal plugin", () => {
    it("loads terminal plugin by default", async () => {
      const loader = createBuiltinServerLoader();
      const result = await loader.load();

      const terminal = result.results.find((r) => r.pluginId === TERMINAL_PLUGIN_ID);
      expect(terminal).toBeDefined();
      expect(terminal?.status).toBe("ready");
    });

    it("can disable terminal plugin", async () => {
      const loader = createBuiltinServerLoader({
        disabledPlugins: new Set([TERMINAL_PLUGIN_ID]),
      });
      const result = await loader.load();

      const terminal = result.results.find((r) => r.pluginId === TERMINAL_PLUGIN_ID);
      expect(terminal?.status).toBe("disabled");
    });

    it("registers terminal lifecycle hooks", async () => {
      const loader = createBuiltinServerLoader();
      const result = await loader.load();

      const serverRegistry = result.serverRegistry;
      const lifecycleHooks = serverRegistry.lifecycleHooks.get("beforeShutdown") ?? [];

      const terminalHooks = lifecycleHooks.filter((h) => h.pluginId === TERMINAL_PLUGIN_ID);
      expect(terminalHooks.length).toBeGreaterThan(0);
    });
  });

  describe("enablement", () => {
    it("respects disabledPlugins set", async () => {
      const loader = createBuiltinServerLoader({
        disabledPlugins: new Set(["openchamber.plugin.example"]),
      });
      const result = await loader.load();

      const example = result.results.find((r) => r.pluginId === "openchamber.plugin.example");
      expect(example?.status).toBe("disabled");
    });

    it("respects enabledPlugins allowlist", async () => {
      const loader = createBuiltinServerLoader({
        enabledPlugins: new Set(),
      });
      const result = await loader.load();

      expect(result.results.every((r) => r.status === "disabled")).toBe(true);
    });
  });

  describe("feature filtering", () => {
    it("passes enabled features to route registration", async () => {
      const loader = createBuiltinServerLoader();
      const result = await loader.load();

      const featureRegistry = result.featureRegistry;
      const terminalEnabled = featureRegistry.isEnabled(TERMINAL_FEATURE_ID);

      expect(terminalEnabled).toBe(true);
    });
  });

  describe("BUILTIN_SERVER_PLUGINS", () => {
    it("exports terminal plugin as first built-in", () => {
      expect(BUILTIN_SERVER_PLUGINS.length).toBeGreaterThan(0);
      expect(BUILTIN_SERVER_PLUGINS[0].id).toBe(TERMINAL_PLUGIN_ID);
    });

    it("built-in plugins have required fields", () => {
      for (const plugin of BUILTIN_SERVER_PLUGINS) {
        expect(plugin.id).toBeDefined();
        expect(plugin.name).toBeDefined();
        expect(plugin.version).toBeDefined();
        expect(plugin.source).toBe("builtin");
        expect(plugin.targets).toContain("server");
      }
    });
  });
});
