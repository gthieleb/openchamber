import { describe, it, expect } from "vitest";
import { FeatureRegistry } from "./feature-registry";

describe("FeatureRegistry", () => {
  describe("registration", () => {
    it("registers a feature definition", () => {
      const registry = new FeatureRegistry();

      registry.register({
        id: "openchamber.feature.terminal",
        name: "Terminal",
        enabledByDefault: true,
      });

      expect(registry.isKnown("openchamber.feature.terminal")).toBe(true);
    });

    it("throws on duplicate feature ID", () => {
      const registry = new FeatureRegistry();

      registry.register({
        id: "openchamber.feature.terminal",
        name: "Terminal",
        enabledByDefault: true,
      });

      expect(() => {
        registry.register({
          id: "openchamber.feature.terminal",
          name: "Terminal 2",
          enabledByDefault: false,
        });
      }).toThrow('Duplicate feature ID: "openchamber.feature.terminal"');
    });

    it("registers features with plugin association", () => {
      const registry = new FeatureRegistry();

      registry.register({
        id: "openchamber.feature.git",
        name: "Git",
        enabledByDefault: true,
        pluginId: "openchamber.plugin.git",
      });

      const entry = registry.getFeature("openchamber.feature.git");
      expect(entry?.pluginId).toBe("openchamber.plugin.git");
    });
  });

  describe("enablement", () => {
    it("returns enabledByDefault when no override is set", () => {
      const registry = new FeatureRegistry();

      registry.register({
        id: "openchamber.feature.terminal",
        name: "Terminal",
        enabledByDefault: true,
      });

      expect(registry.isEnabled("openchamber.feature.terminal")).toBe(true);
    });

    it("returns false for unregistered features", () => {
      const registry = new FeatureRegistry();

      expect(registry.isEnabled("openchamber.feature.unknown")).toBe(false);
    });

    it("respects override to disable a feature", () => {
      const registry = new FeatureRegistry();

      registry.register({
        id: "openchamber.feature.terminal",
        name: "Terminal",
        enabledByDefault: true,
      });

      registry.setEnabled("openchamber.feature.terminal", false);

      expect(registry.isEnabled("openchamber.feature.terminal")).toBe(false);
    });

    it("respects override to enable a feature", () => {
      const registry = new FeatureRegistry();

      registry.register({
        id: "openchamber.feature.plan-mode",
        name: "Plan Mode",
        enabledByDefault: false,
      });

      registry.setEnabled("openchamber.feature.plan-mode", true);

      expect(registry.isEnabled("openchamber.feature.plan-mode")).toBe(true);
    });

    it("silently ignores setEnabled for unknown features", () => {
      const registry = new FeatureRegistry();

      expect(() => {
        registry.setEnabled("openchamber.feature.unknown", true);
      }).not.toThrow();

      expect(registry.isEnabled("openchamber.feature.unknown")).toBe(false);
    });
  });

  describe("feature entry", () => {
    it("returns undefined for unknown features", () => {
      const registry = new FeatureRegistry();

      expect(registry.getFeature("openchamber.feature.unknown")).toBeUndefined();
    });

    it("returns feature entry with correct state", () => {
      const registry = new FeatureRegistry();

      registry.register({
        id: "openchamber.feature.git",
        name: "Git",
        description: "Git integration",
        enabledByDefault: true,
        pluginId: "openchamber.plugin.git",
      });

      const entry = registry.getFeature("openchamber.feature.git");

      expect(entry).toMatchObject({
        id: "openchamber.feature.git",
        name: "Git",
        description: "Git integration",
        enabled: true,
        enabledByDefault: true,
        pluginId: "openchamber.plugin.git",
        overridden: false,
      });
    });

    it("marks overridden when override is set", () => {
      const registry = new FeatureRegistry();

      registry.register({
        id: "openchamber.feature.terminal",
        name: "Terminal",
        enabledByDefault: true,
      });

      registry.setEnabled("openchamber.feature.terminal", false);

      const entry = registry.getFeature("openchamber.feature.terminal");
      expect(entry?.overridden).toBe(true);
    });
  });

  describe("snapshot", () => {
    it("returns snapshot with all registered features", () => {
      const registry = new FeatureRegistry();

      registry.register({
        id: "openchamber.feature.terminal",
        name: "Terminal",
        enabledByDefault: true,
      });

      registry.register({
        id: "openchamber.feature.plan-mode",
        name: "Plan Mode",
        enabledByDefault: false,
      });

      const snapshot = registry.getSnapshot();

      expect(snapshot.features).toHaveLength(2);
      expect(snapshot.updatedAt).toBeDefined();
    });

    it("snapshot reflects current enablement state", () => {
      const registry = new FeatureRegistry();

      registry.register({
        id: "openchamber.feature.terminal",
        name: "Terminal",
        enabledByDefault: true,
      });

      registry.setEnabled("openchamber.feature.terminal", false);

      const snapshot = registry.getSnapshot();
      const terminal = snapshot.features.find((f) => f.id === "openchamber.feature.terminal");

      expect(terminal?.enabled).toBe(false);
    });
  });

  describe("getAll and getDefinitions", () => {
    it("getAll returns all feature entries", () => {
      const registry = new FeatureRegistry();

      registry.register({
        id: "openchamber.feature.terminal",
        name: "Terminal",
        enabledByDefault: true,
      });

      registry.register({
        id: "openchamber.feature.files",
        name: "Files",
        enabledByDefault: true,
      });

      const all = registry.getAll();
      expect(all).toHaveLength(2);
    });

    it("getDefinitions returns raw definitions", () => {
      const registry = new FeatureRegistry();

      registry.register({
        id: "openchamber.feature.terminal",
        name: "Terminal",
        enabledByDefault: true,
        description: "Terminal feature",
      });

      const defs = registry.getDefinitions();
      expect(defs).toHaveLength(1);
      expect(defs[0].description).toBe("Terminal feature");
    });
  });

  describe("built-in feature IDs", () => {
    it("accepts standard feature IDs", () => {
      const registry = new FeatureRegistry();

      const features = [
        { id: "openchamber.feature.terminal", name: "Terminal", enabledByDefault: true },
        { id: "openchamber.feature.files", name: "Files", enabledByDefault: true },
        { id: "openchamber.feature.git", name: "Git", enabledByDefault: true },
        { id: "openchamber.feature.plan-mode", name: "Plan Mode", enabledByDefault: false },
      ];

      for (const f of features) {
        registry.register(f);
      }

      expect(registry.getAll()).toHaveLength(4);
    });
  });
});
