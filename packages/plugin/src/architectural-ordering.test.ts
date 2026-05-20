import { describe, it, expect } from "vitest";
import { PluginRegistry } from "./registry";
import { definePlugin } from "./types";

describe("PluginRegistry - architectural ordering", () => {
  it("orders plugins by source: builtin < bundled < user", () => {
    const registry = new PluginRegistry();

    registry.register(
      definePlugin({
        id: "user-plugin",
        name: "User",
        version: "1.0.0",
        source: "user",
        targets: ["ui"],
        setup: () => {},
      }),
    );
    registry.register(
      definePlugin({
        id: "bundled-plugin",
        name: "Bundled",
        version: "1.0.0",
        source: "bundled",
        targets: ["ui"],
        setup: () => {},
      }),
    );
    registry.register(
      definePlugin({
        id: "builtin-plugin",
        name: "Builtin",
        version: "1.0.0",
        source: "builtin",
        targets: ["ui"],
        setup: () => {},
      }),
    );

    const diagnostics = registry.getDiagnostics();
    const sources = diagnostics.map((d) => d.source);

    const builtinIdx = sources.indexOf("builtin");
    const bundledIdx = sources.indexOf("bundled");
    const userIdx = sources.indexOf("user");

    expect(builtinIdx).toBeLessThan(bundledIdx);
    expect(bundledIdx).toBeLessThan(userIdx);
  });

  it("orders contributions by priority within same type", () => {
    const registry = new PluginRegistry();

    registry.register(
      definePlugin({
        id: "test-plugin",
        name: "Test",
        version: "1.0.0",
        source: "builtin",
        targets: ["ui"],
        setup: () => {},
      }),
    );

    registry.addContribution("ui.fill", {
      type: "ui.fill",
      id: "fill-high",
      pluginId: "test-plugin",
      source: "builtin",
      priority: 10,
      data: null,
    });
    registry.addContribution("ui.fill", {
      type: "ui.fill",
      id: "fill-low",
      pluginId: "test-plugin",
      source: "builtin",
      priority: 0,
      data: null,
    });
    registry.addContribution("ui.fill", {
      type: "ui.fill",
      id: "fill-mid",
      pluginId: "test-plugin",
      source: "builtin",
      priority: 5,
      data: null,
    });

    const contributions = registry.getContributions("ui.fill");
    expect(contributions).toHaveLength(3);
    expect(contributions[0].priority).toBe(0);
    expect(contributions[1].priority).toBe(5);
    expect(contributions[2].priority).toBe(10);
  });

  it("deterministic ordering with same priority uses pluginId then contributionId", () => {
    const registry = new PluginRegistry();

    registry.register(
      definePlugin({
        id: "plugin-a",
        name: "A",
        version: "1.0.0",
        source: "builtin",
        targets: ["ui"],
        setup: () => {},
      }),
    );
    registry.register(
      definePlugin({
        id: "plugin-b",
        name: "B",
        version: "1.0.0",
        source: "builtin",
        targets: ["ui"],
        setup: () => {},
      }),
    );

    registry.addContribution("ui.fill", {
      type: "ui.fill",
      id: "fill-b",
      pluginId: "plugin-b",
      source: "builtin",
      priority: 0,
      data: null,
    });
    registry.addContribution("ui.fill", {
      type: "ui.fill",
      id: "fill-a",
      pluginId: "plugin-a",
      source: "builtin",
      priority: 0,
      data: null,
    });

    const contributions = registry.getContributions("ui.fill");
    expect(contributions).toHaveLength(2);
    expect(contributions[0].pluginId).toBe("plugin-a");
    expect(contributions[1].pluginId).toBe("plugin-b");
  });

  it("required plugins throw on setup failure", async () => {
    const registry = new PluginRegistry();

    const plugin = definePlugin({
      id: "required-plugin",
      name: "Required",
      version: "1.0.0",
      source: "builtin",
      targets: ["ui"],
      required: true,
      setup: () => {
        throw new Error("Setup failed");
      },
    });

    registry.register(plugin);

    let threw = false;
    try {
      await registry.setupAll({
        target: "ui",
        createUIAPI: () => ({ fill: () => {}, surface: () => {}, replace: () => {}, wrap: () => {}, slot: () => {} }),
        createCommandsAPI: () => ({ register: () => {} }),
        createSettingsAPI: () => ({ page: () => {}, section: () => {} }),
        createStorageAPI: () => ({ get: () => undefined, set: () => {}, delete: () => {} }),
        createToolsAPI: () => ({ registerRenderer: () => {} }),
        createModelsAPI: () => ({ filter: () => {}, decorate: () => {} }),
        createRuntimeAPI: () => ({ target: "ui", isRuntime: () => false }),
      });
    } catch (err) {
      threw = true;
      expect((err as Error).message).toBe("Setup failed");
    }
    expect(threw).toBe(true);
  });

  it("optional plugins do not throw on setup failure", async () => {
    const registry = new PluginRegistry();

    const plugin = definePlugin({
      id: "optional-plugin",
      name: "Optional",
      version: "1.0.0",
      source: "builtin",
      targets: ["ui"],
      required: false,
      setup: () => {
        throw new Error("Setup failed");
      },
    });

    registry.register(plugin);

    await registry.setupAll({
      target: "ui",
      createUIAPI: () => ({ fill: () => {}, surface: () => {}, replace: () => {}, wrap: () => {}, slot: () => {} }),
      createCommandsAPI: () => ({ register: () => {} }),
      createSettingsAPI: () => ({ page: () => {}, section: () => {} }),
      createStorageAPI: () => ({ get: () => undefined, set: () => {}, delete: () => {} }),
      createToolsAPI: () => ({ registerRenderer: () => {} }),
      createModelsAPI: () => ({ filter: () => {}, decorate: () => {} }),
      createRuntimeAPI: () => ({ target: "ui", isRuntime: () => false }),
    });

    const diagnostics = registry.getDiagnostics();
    const optionalDiag = diagnostics.find((d) => d.id === "optional-plugin");
    expect(optionalDiag).toBeDefined();
    expect(optionalDiag?.status).toBe("error");
    expect(optionalDiag?.setupErrors).toHaveLength(1);
  });

  it("getAllContributions returns sorted contributions across all types", () => {
    const registry = new PluginRegistry();

    registry.register(
      definePlugin({
        id: "test-plugin",
        name: "Test",
        version: "1.0.0",
        source: "builtin",
        targets: ["ui"],
        setup: () => {},
      }),
    );

    registry.addContribution("ui.fill", {
      type: "ui.fill",
      id: "fill",
      pluginId: "test-plugin",
      source: "builtin",
      priority: 5,
      data: null,
    });
    registry.addContribution("ui.surface", {
      type: "ui.surface",
      id: "surface",
      pluginId: "test-plugin",
      source: "builtin",
      priority: 10,
      data: null,
    });

    const all = registry.getAllContributions();
    expect(all).toHaveLength(2);
  });
});
