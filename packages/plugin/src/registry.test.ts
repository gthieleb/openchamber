import { describe, it, expect } from "vitest";
import { definePlugin, PluginRegistry } from "./index";
import type { PluginContext, PluginTarget } from "./types";

function createTestAPIs(registry?: PluginRegistry) {
  const contributions: Array<{ type: string; record: unknown }> = [];

  const trackContribution = (type: string, pid: string, data: unknown) => {
    contributions.push({ type, record: data });
    if (registry) {
      registry.addContribution(type, {
        type,
        id: `${pid}:${type}:${contributions.filter((c) => c.type === type).length}`,
        pluginId: pid,
        source: "builtin",
        priority: 0,
        data,
      });
    }
  };

  return {
    contributions,
    createUIAPI: (pid: string) => ({
      fill: (slotId: string, component: unknown, options?: { priority?: number }) => {
        trackContribution("ui.fill", pid, { slotId, component, options });
      },
      surface: (surfaceId: string, config: unknown) => {
        trackContribution("ui.surface", pid, { surfaceId, config });
      },
      slot: (slotId: string, config: unknown) => {
        trackContribution("ui.slot", pid, { slotId, config });
      },
      replace: (targetId: string, component: unknown, options?: { priority?: number }) => {
        trackContribution("ui.replace", pid, { targetId, component, options });
      },
      wrap: (targetId: string, wrapper: unknown, options?: { priority?: number }) => {
        trackContribution("ui.wrap", pid, { targetId, wrapper, options });
      },
    }),
    createCommandsAPI: (pid: string) => ({
      register: (commandId: string, config: { title: string; run: (...args: unknown[]) => unknown }) => {
        trackContribution("command", pid, { commandId, config });
      },
    }),
    createSettingsAPI: (pid: string) => ({
      page: (pageId: string, config: { title: string; render: unknown }) => {
        trackContribution("settings.page", pid, { pageId, config });
      },
      section: (pageId: string, sectionId: string, config: { title: string; render: unknown }) => {
        trackContribution("settings.section", pid, { pageId, sectionId, config });
      },
    }),
    createStorageAPI: () => {
      const store = new Map<string, unknown>();
      return {
        get: <T>(key: string) => store.get(key) as T | undefined,
        set: <T>(key: string, value: T) => { store.set(key, value); },
        delete: (key: string) => { store.delete(key); },
      };
    },
    createToolsAPI: (pid: string) => ({
      registerRenderer: (toolName: string, renderer: unknown) => {
        trackContribution("tool.renderer", pid, { toolName, renderer });
      },
    }),
    createModelsAPI: () => ({
      filter: () => {},
      decorate: () => {},
    }),
    createRuntimeAPI: (target: PluginTarget) => ({
      target,
      isRuntime: (t: PluginTarget) => t === target,
    }),
    createServerAPI: () => ({
      routes: (routeId: string) => {
        trackContribution("server.route", "server", { routeId });
      },
      middleware: (middlewareId: string) => {
        trackContribution("server.middleware", "server", { middlewareId });
      },
      lifecycle: (hook: string) => {
        trackContribution("server.lifecycle", "server", { hook });
      },
    }),
  };
}

describe("PluginRegistry", () => {
  describe("registration", () => {
    it("registers a plugin from PluginDefinition", () => {
      const registry = new PluginRegistry();

      registry.register({
        id: "test.plugin",
        name: "Test",
        version: "1.0.0",
        setup: () => {},
      });

      expect(registry.getPlugin("test.plugin")).toBeDefined();
    });

    it("registers a plugin from definePlugin()", () => {
      const registry = new PluginRegistry();

      const plugin = definePlugin({
        id: "test.plugin",
        name: "Test",
        version: "1.0.0",
        setup: () => {},
      });

      registry.register(plugin);

      expect(registry.getPlugin("test.plugin")).toBeDefined();
    });

    it("throws on duplicate plugin ID", () => {
      const registry = new PluginRegistry();

      registry.register({
        id: "test.plugin",
        name: "Test",
        version: "1.0.0",
        setup: () => {},
      });

      expect(() => {
        registry.register({
          id: "test.plugin",
          name: "Test 2",
          version: "1.0.0",
          setup: () => {},
        });
      }).toThrow('Duplicate plugin ID: "test.plugin"');
    });

    it("throws on missing plugin ID", () => {
      const registry = new PluginRegistry();

      expect(() => {
        registry.register({
          id: "",
          name: "Test",
          version: "1.0.0",
          setup: () => {},
        });
      }).toThrow("Plugin definition missing required field: id");
    });

    it("defaults source to builtin", () => {
      const registry = new PluginRegistry();

      registry.register({
        id: "test.plugin",
        name: "Test",
        version: "1.0.0",
        setup: () => {},
      });

      const entry = registry.getPlugin("test.plugin");
      expect(entry?.manifest.source).toBe("builtin");
    });

    it("defaults targets to ui and server", () => {
      const registry = new PluginRegistry();

      registry.register({
        id: "test.plugin",
        name: "Test",
        version: "1.0.0",
        setup: () => {},
      });

      const entry = registry.getPlugin("test.plugin");
      expect(entry?.manifest.targets).toEqual(["ui", "server"]);
    });

    it("defaults priority to 0", () => {
      const registry = new PluginRegistry();

      registry.register({
        id: "test.plugin",
        name: "Test",
        version: "1.0.0",
        setup: () => {},
      });

      const entry = registry.getPlugin("test.plugin");
      expect(entry?.manifest.priority).toBe(0);
    });

    it("defaults required to false", () => {
      const registry = new PluginRegistry();

      registry.register({
        id: "test.plugin",
        name: "Test",
        version: "1.0.0",
        setup: () => {},
      });

      const entry = registry.getPlugin("test.plugin");
      expect(entry?.manifest.required).toBe(false);
    });
  });

  describe("source ordering", () => {
    it("orders plugins by source: builtin before bundled before user", async () => {
      const registry = new PluginRegistry();
      const order: string[] = [];

      registry.register({
        id: "user.plugin",
        name: "User",
        version: "1.0.0",
        source: "user",
        setup: () => { order.push("user"); },
      });

      registry.register({
        id: "builtin.plugin",
        name: "Builtin",
        version: "1.0.0",
        source: "builtin",
        setup: () => { order.push("builtin"); },
      });

      registry.register({
        id: "bundled.plugin",
        name: "Bundled",
        version: "1.0.0",
        source: "bundled",
        setup: () => { order.push("bundled"); },
      });

      const apis = createTestAPIs();
      await registry.setupAll({
        target: "ui",
        createUIAPI: apis.createUIAPI,
        createCommandsAPI: apis.createCommandsAPI,
        createSettingsAPI: apis.createSettingsAPI,
        createStorageAPI: apis.createStorageAPI,
        createToolsAPI: apis.createToolsAPI,
        createModelsAPI: apis.createModelsAPI,
        createRuntimeAPI: apis.createRuntimeAPI,
      });

      expect(order).toEqual(["builtin", "bundled", "user"]);
    });

    it("orders plugins by priority within same source", async () => {
      const registry = new PluginRegistry();
      const order: string[] = [];

      registry.register({
        id: "test.low",
        name: "Low",
        version: "1.0.0",
        source: "builtin",
        priority: 10,
        setup: () => { order.push("low"); },
      });

      registry.register({
        id: "test.high",
        name: "High",
        version: "1.0.0",
        source: "builtin",
        priority: 100,
        setup: () => { order.push("high"); },
      });

      registry.register({
        id: "test.mid",
        name: "Mid",
        version: "1.0.0",
        source: "builtin",
        priority: 50,
        setup: () => { order.push("mid"); },
      });

      const apis = createTestAPIs();
      await registry.setupAll({
        target: "ui",
        createUIAPI: apis.createUIAPI,
        createCommandsAPI: apis.createCommandsAPI,
        createSettingsAPI: apis.createSettingsAPI,
        createStorageAPI: apis.createStorageAPI,
        createToolsAPI: apis.createToolsAPI,
        createModelsAPI: apis.createModelsAPI,
        createRuntimeAPI: apis.createRuntimeAPI,
      });

      expect(order).toEqual(["low", "mid", "high"]);
    });

    it("uses pluginId as tie-breaker for same source and priority", async () => {
      const registry = new PluginRegistry();
      const order: string[] = [];

      registry.register({
        id: "test.zeta",
        name: "Zeta",
        version: "1.0.0",
        source: "builtin",
        priority: 0,
        setup: () => { order.push("zeta"); },
      });

      registry.register({
        id: "test.alpha",
        name: "Alpha",
        version: "1.0.0",
        source: "builtin",
        priority: 0,
        setup: () => { order.push("alpha"); },
      });

      registry.register({
        id: "test.beta",
        name: "Beta",
        version: "1.0.0",
        source: "builtin",
        priority: 0,
        setup: () => { order.push("beta"); },
      });

      const apis = createTestAPIs();
      await registry.setupAll({
        target: "ui",
        createUIAPI: apis.createUIAPI,
        createCommandsAPI: apis.createCommandsAPI,
        createSettingsAPI: apis.createSettingsAPI,
        createStorageAPI: apis.createStorageAPI,
        createToolsAPI: apis.createToolsAPI,
        createModelsAPI: apis.createModelsAPI,
        createRuntimeAPI: apis.createRuntimeAPI,
      });

      expect(order).toEqual(["alpha", "beta", "zeta"]);
    });
  });

  describe("setup", () => {
    it("calls plugin setup function with correct context", async () => {
      const registry = new PluginRegistry();
      let capturedCtx: PluginContext | undefined;

      registry.register({
        id: "test.plugin",
        name: "Test",
        version: "1.0.0",
        source: "builtin",
        capabilities: ["ui.fill", "ui.surface"],
        setup: (ctx) => { capturedCtx = ctx; },
      });

      const apis = createTestAPIs();
      await registry.setupAll({
        target: "ui",
        createUIAPI: apis.createUIAPI,
        createCommandsAPI: apis.createCommandsAPI,
        createSettingsAPI: apis.createSettingsAPI,
        createStorageAPI: apis.createStorageAPI,
        createToolsAPI: apis.createToolsAPI,
        createModelsAPI: apis.createModelsAPI,
        createRuntimeAPI: apis.createRuntimeAPI,
      });

      expect(capturedCtx).toBeDefined();
      expect(capturedCtx?.manifest.id).toBe("test.plugin");
      expect(capturedCtx?.manifest.name).toBe("Test");
      expect(capturedCtx?.manifest.source).toBe("builtin");
    });

    it("records setup errors without crashing for non-required plugins", async () => {
      const registry = new PluginRegistry();

      registry.register({
        id: "test.failing",
        name: "Failing",
        version: "1.0.0",
        setup: () => { throw new Error("setup failed"); },
      });

      const apis = createTestAPIs();
      await expect(
        registry.setupAll({
          target: "ui",
          createUIAPI: apis.createUIAPI,
          createCommandsAPI: apis.createCommandsAPI,
          createSettingsAPI: apis.createSettingsAPI,
          createStorageAPI: apis.createStorageAPI,
          createToolsAPI: apis.createToolsAPI,
          createModelsAPI: apis.createModelsAPI,
          createRuntimeAPI: apis.createRuntimeAPI,
        }),
      ).resolves.not.toThrow();

      const entry = registry.getPlugin("test.failing");
      expect(entry?.status).toBe("error");
      expect(entry?.setupErrors).toContain("setup failed");
    });

    it("throws setup error for required plugins", async () => {
      const registry = new PluginRegistry();

      registry.register({
        id: "test.required",
        name: "Required",
        version: "1.0.0",
        required: true,
        setup: () => { throw new Error("required setup failed"); },
      });

      const apis = createTestAPIs();
      await expect(
        registry.setupAll({
          target: "ui",
          createUIAPI: apis.createUIAPI,
          createCommandsAPI: apis.createCommandsAPI,
          createSettingsAPI: apis.createSettingsAPI,
          createStorageAPI: apis.createStorageAPI,
          createToolsAPI: apis.createToolsAPI,
          createModelsAPI: apis.createModelsAPI,
          createRuntimeAPI: apis.createRuntimeAPI,
        }),
      ).rejects.toThrow("required setup failed");

      const entry = registry.getPlugin("test.required");
      expect(entry?.status).toBe("error");
    });

    it("skips plugins that do not support the current target", async () => {
      const registry = new PluginRegistry();
      let uiSetupCalled = false;
      let serverSetupCalled = false;

      registry.register({
        id: "test.ui-only",
        name: "UI Only",
        version: "1.0.0",
        targets: ["ui"],
        setup: () => { uiSetupCalled = true; },
      });

      registry.register({
        id: "test.server-only",
        name: "Server Only",
        version: "1.0.0",
        targets: ["server"],
        setup: () => { serverSetupCalled = true; },
      });

      const apis = createTestAPIs();
      await registry.setupAll({
        target: "ui",
        createUIAPI: apis.createUIAPI,
        createCommandsAPI: apis.createCommandsAPI,
        createSettingsAPI: apis.createSettingsAPI,
        createStorageAPI: apis.createStorageAPI,
        createToolsAPI: apis.createToolsAPI,
        createModelsAPI: apis.createModelsAPI,
        createRuntimeAPI: apis.createRuntimeAPI,
      });

      expect(uiSetupCalled).toBe(true);
      expect(serverSetupCalled).toBe(false);

      const serverEntry = registry.getPlugin("test.server-only");
      expect(serverEntry?.status).toBe("disabled");
    });

    it("supports async setup functions", async () => {
      const registry = new PluginRegistry();

      registry.register({
        id: "test.async",
        name: "Async",
        version: "1.0.0",
        setup: async () => {
          await Promise.resolve();
        },
      });

      const apis = createTestAPIs();
      await registry.setupAll({
        target: "ui",
        createUIAPI: apis.createUIAPI,
        createCommandsAPI: apis.createCommandsAPI,
        createSettingsAPI: apis.createSettingsAPI,
        createStorageAPI: apis.createStorageAPI,
        createToolsAPI: apis.createToolsAPI,
        createModelsAPI: apis.createModelsAPI,
        createRuntimeAPI: apis.createRuntimeAPI,
      });

      const entry = registry.getPlugin("test.async");
      expect(entry?.status).toBe("ready");
    });
  });

  describe("capabilities", () => {
    it("grants declared capabilities by default", async () => {
      const registry = new PluginRegistry();
      let hasFill = false;
      let hasSurface = false;

      registry.register({
        id: "test.caps",
        name: "Caps",
        version: "1.0.0",
        capabilities: ["ui.fill", "ui.surface"],
        setup: (ctx) => {
          hasFill = ctx.capabilities.has("ui.fill");
          hasSurface = ctx.capabilities.has("ui.surface");
        },
      });

      const apis = createTestAPIs();
      await registry.setupAll({
        target: "ui",
        createUIAPI: apis.createUIAPI,
        createCommandsAPI: apis.createCommandsAPI,
        createSettingsAPI: apis.createSettingsAPI,
        createStorageAPI: apis.createStorageAPI,
        createToolsAPI: apis.createToolsAPI,
        createModelsAPI: apis.createModelsAPI,
        createRuntimeAPI: apis.createRuntimeAPI,
      });

      expect(hasFill).toBe(true);
      expect(hasSurface).toBe(true);
    });

    it("denies capabilities in deniedCapabilities list", async () => {
      const registry = new PluginRegistry();
      let hasFill = false;

      registry.register(
        {
          id: "test.restricted",
          name: "Restricted",
          version: "1.0.0",
          capabilities: ["ui.fill", "ui.surface"],
          setup: (ctx) => {
            hasFill = ctx.capabilities.has("ui.fill");
          },
        },
        {
          deniedCapabilities: ["ui.fill"],
        },
      );

      const apis = createTestAPIs();
      await registry.setupAll({
        target: "ui",
        createUIAPI: apis.createUIAPI,
        createCommandsAPI: apis.createCommandsAPI,
        createSettingsAPI: apis.createSettingsAPI,
        createStorageAPI: apis.createStorageAPI,
        createToolsAPI: apis.createToolsAPI,
        createModelsAPI: apis.createModelsAPI,
        createRuntimeAPI: apis.createRuntimeAPI,
      });

      expect(hasFill).toBe(false);
    });
  });

  describe("contributions", () => {
    it("tracks contributions added during setup", async () => {
      const registry = new PluginRegistry();

      registry.register({
        id: "test.contrib",
        name: "Contrib",
        version: "1.0.0",
        setup: (ctx) => {
          ctx.ui.fill("toolbar.actions", "TestButton", { priority: 10 });
          ctx.ui.surface("test.view", {
            title: "Test",
            placements: ["workbench.main"],
            render: "TestView",
          });
        },
      });

      const apis = createTestAPIs();
      await registry.setupAll({
        target: "ui",
        createUIAPI: apis.createUIAPI,
        createCommandsAPI: apis.createCommandsAPI,
        createSettingsAPI: apis.createSettingsAPI,
        createStorageAPI: apis.createStorageAPI,
        createToolsAPI: apis.createToolsAPI,
        createModelsAPI: apis.createModelsAPI,
        createRuntimeAPI: apis.createRuntimeAPI,
      });

      const fills = apis.contributions.filter((c) => c.type === "ui.fill");
      const surfaces = apis.contributions.filter((c) => c.type === "ui.surface");

      expect(fills).toHaveLength(1);
      expect(surfaces).toHaveLength(1);
    });
  });

  describe("disposables", () => {
    it("registers and calls disposables", async () => {
      const registry = new PluginRegistry();
      let disposed = false;

      registry.register({
        id: "test.disposable",
        name: "Disposable",
        version: "1.0.0",
        setup: (ctx) => {
          ctx.runtime.isRuntime("ui");
        },
      });

      registry.addDisposable("test.disposable", () => {
        disposed = true;
      });

      await registry.dispose();

      expect(disposed).toBe(true);
    });

    it("continues disposal even if one disposable throws", async () => {
      const registry = new PluginRegistry();
      let secondDisposed = false;

      registry.addDisposable("test.a", () => {
        throw new Error("fail");
      });

      registry.addDisposable("test.b", () => {
        secondDisposed = true;
      });

      await registry.dispose();

      expect(secondDisposed).toBe(true);
    });
  });

  describe("diagnostics", () => {
    it("returns diagnostics for all registered plugins", async () => {
      const registry = new PluginRegistry();

      registry.register({
        id: "test.diag",
        name: "Diagnostic",
        version: "2.0.0",
        source: "bundled",
        capabilities: ["ui.fill"],
        setup: (ctx) => {
          ctx.ui.fill("test.slot", "Component");
        },
      });

      const apis = createTestAPIs(registry);
      await registry.setupAll({
        target: "ui",
        createUIAPI: apis.createUIAPI,
        createCommandsAPI: apis.createCommandsAPI,
        createSettingsAPI: apis.createSettingsAPI,
        createStorageAPI: apis.createStorageAPI,
        createToolsAPI: apis.createToolsAPI,
        createModelsAPI: apis.createModelsAPI,
        createRuntimeAPI: apis.createRuntimeAPI,
      });

      const diagnostics = registry.getDiagnostics();

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]).toMatchObject({
        id: "test.diag",
        name: "Diagnostic",
        version: "2.0.0",
        source: "bundled",
        status: "ready",
        grantedCapabilities: ["ui.fill"],
        contributionCount: 1,
        setupErrors: [],
      });
    });

    it("includes setup errors in diagnostics", async () => {
      const registry = new PluginRegistry();

      registry.register({
        id: "test.error-diag",
        name: "Error Diag",
        version: "1.0.0",
        setup: () => { throw new Error("boom"); },
      });

      const apis = createTestAPIs();
      await registry.setupAll({
        target: "ui",
        createUIAPI: apis.createUIAPI,
        createCommandsAPI: apis.createCommandsAPI,
        createSettingsAPI: apis.createSettingsAPI,
        createStorageAPI: apis.createStorageAPI,
        createToolsAPI: apis.createToolsAPI,
        createModelsAPI: apis.createModelsAPI,
        createRuntimeAPI: apis.createRuntimeAPI,
      });

      const diagnostics = registry.getDiagnostics();

      expect(diagnostics[0].status).toBe("error");
      expect(diagnostics[0].setupErrors).toContain("boom");
    });
  });

  describe("contribution ordering", () => {
    it("sorts contributions by source, priority, pluginId, contributionId", () => {
      const registry = new PluginRegistry();

      registry.register({
        id: "user.plugin",
        name: "User",
        version: "1.0.0",
        source: "user",
        setup: () => {},
      });

      registry.register({
        id: "builtin.plugin",
        name: "Builtin",
        version: "1.0.0",
        source: "builtin",
        setup: () => {},
      });

      registry.addContribution("ui.fill", {
        type: "ui.fill",
        id: "slot-b",
        pluginId: "builtin.plugin",
        source: "builtin",
        priority: 10,
        data: "BuiltinB",
      });

      registry.addContribution("ui.fill", {
        type: "ui.fill",
        id: "slot-a",
        pluginId: "builtin.plugin",
        source: "builtin",
        priority: 10,
        data: "BuiltinA",
      });

      registry.addContribution("ui.fill", {
        type: "ui.fill",
        id: "slot-a",
        pluginId: "user.plugin",
        source: "user",
        priority: 5,
        data: "UserA",
      });

      const contributions = registry.getContributions("ui.fill");

      expect(contributions[0].data).toBe("BuiltinA");
      expect(contributions[1].data).toBe("BuiltinB");
      expect(contributions[2].data).toBe("UserA");
    });
  });
});
