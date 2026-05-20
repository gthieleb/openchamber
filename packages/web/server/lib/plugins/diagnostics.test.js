import { describe, it, expect } from "vitest";
import { createPluginDiagnostics } from "./diagnostics.js";
import { createServerPluginRegistry } from "./registry.js";

describe("createPluginDiagnostics", () => {
  it("returns diagnostics for all built-in plugins", () => {
    const serverRegistry = createServerPluginRegistry();
    const diagnostics = createPluginDiagnostics({ serverRegistry });

    const result = diagnostics.getPluginDiagnostics();

    expect(result.pluginCount).toBeGreaterThan(0);
    expect(result.plugins).toHaveLength(result.pluginCount);
    expect(result.plugins[0]).toHaveProperty("id");
    expect(result.plugins[0]).toHaveProperty("name");
    expect(result.plugins[0]).toHaveProperty("source");
    expect(result.plugins[0]).toHaveProperty("capabilities");
    expect(result.plugins[0]).toHaveProperty("enabled");
    expect(result.plugins[0]).toHaveProperty("status");
  });

  it("returns diagnostics for a specific plugin by ID", () => {
    const serverRegistry = createServerPluginRegistry();
    const diagnostics = createPluginDiagnostics({ serverRegistry });

    const result = diagnostics.getPluginDiagnosticsById("openchamber.plugin.terminal");

    expect(result).not.toBeNull();
    expect(result.id).toBe("openchamber.plugin.terminal");
    expect(result.name).toBe("Terminal");
  });

  it("returns null for unknown plugin ID", () => {
    const serverRegistry = createServerPluginRegistry();
    const diagnostics = createPluginDiagnostics({ serverRegistry });

    const result = diagnostics.getPluginDiagnosticsById("nonexistent.plugin");

    expect(result).toBeNull();
  });

  it("includes contribution data when routes are registered", () => {
    const serverRegistry = createServerPluginRegistry();
    const diagnostics = createPluginDiagnostics({ serverRegistry });

    serverRegistry.registerRoutes("test.route", () => {}, "openchamber.plugin.terminal", "builtin", {
      phase: "postAuthFeatureRoutes",
      featureId: "openchamber.feature.terminal",
    });

    const result = diagnostics.getPluginDiagnostics();
    const terminalPlugin = result.plugins.find((p) => p.id === "openchamber.plugin.terminal");

    expect(terminalPlugin.contributionCount).toBeGreaterThan(0);
    expect(terminalPlugin.contributions).toHaveLength(terminalPlugin.contributionCount);
  });

  it("includes loadedAt timestamp", () => {
    const serverRegistry = createServerPluginRegistry();
    const diagnostics = createPluginDiagnostics({ serverRegistry });

    const result = diagnostics.getPluginDiagnostics();

    expect(result.loadedAt).toBeDefined();
    expect(new Date(result.loadedAt).getTime()).toBeLessThanOrEqual(Date.now());
  });
});
