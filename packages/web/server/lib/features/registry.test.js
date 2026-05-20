import { describe, it, expect } from "vitest";
import { createFeatureRegistry, createFeatureGate, FeatureRegistry } from "./registry.js";

describe("FeatureRegistry (server)", () => {
  describe("createFeatureRegistry", () => {
    it("registers builtin features automatically", () => {
      const registry = createFeatureRegistry();
      const snapshot = registry.getSnapshot();

      expect(snapshot.features).toHaveLength(4);
      expect(snapshot.features.some((f) => f.id === "openchamber.feature.terminal")).toBe(true);
      expect(snapshot.features.some((f) => f.id === "openchamber.feature.files")).toBe(true);
      expect(snapshot.features.some((f) => f.id === "openchamber.feature.git")).toBe(true);
      expect(snapshot.features.some((f) => f.id === "openchamber.feature.plan-mode")).toBe(true);
    });

    it("terminal is enabled by default", () => {
      const registry = createFeatureRegistry();
      expect(registry.isEnabled("openchamber.feature.terminal")).toBe(true);
    });

    it("plan-mode is disabled by default", () => {
      const registry = createFeatureRegistry();
      expect(registry.isEnabled("openchamber.feature.plan-mode")).toBe(false);
    });
  });

  describe("feature gating", () => {
    it("returns 503 for disabled features", () => {
      const registry = createFeatureRegistry();
      const gate = createFeatureGate(registry);

      const middleware = gate("openchamber.feature.plan-mode");

      const req = {};
      const res = {
        status: (code) => {
          expect(code).toBe(503);
          return {
            json: (body) => {
              expect(body.error).toBe("Feature disabled");
              expect(body.featureId).toBe("openchamber.feature.plan-mode");
            },
          };
        },
      };
      const next = () => {
        throw new Error("next should not be called");
      };

      middleware(req, res, next);
    });

    it("calls next for enabled features", () => {
      const registry = createFeatureRegistry();
      const gate = createFeatureGate(registry);

      const middleware = gate("openchamber.feature.terminal");

      let nextCalled = false;
      const req = {};
      const res = {};
      const next = () => {
        nextCalled = true;
      };

      middleware(req, res, next);

      expect(nextCalled).toBe(true);
    });

    it("returns 404 for unknown features", () => {
      const registry = createFeatureRegistry();
      const gate = createFeatureGate(registry);

      const middleware = gate("openchamber.feature.unknown");

      const req = {};
      const res = {
        status: (code) => {
          expect(code).toBe(404);
          return {
            json: (body) => {
              expect(body.error).toBe("Feature not found");
              expect(body.featureId).toBe("openchamber.feature.unknown");
            },
          };
        },
      };
      const next = () => {
        throw new Error("next should not be called");
      };

      middleware(req, res, next);
    });
  });

  describe("FeatureRegistry", () => {
    it("allows adding custom features", () => {
      const registry = new FeatureRegistry();

      registry.register({
        id: "custom.feature",
        name: "Custom",
        enabledByDefault: true,
      });

      expect(registry.isEnabled("custom.feature")).toBe(true);
    });

    it("throws on duplicate registration", () => {
      const registry = new FeatureRegistry();

      registry.register({
        id: "custom.feature",
        name: "Custom",
        enabledByDefault: true,
      });

      expect(() => {
        registry.register({
          id: "custom.feature",
          name: "Custom 2",
          enabledByDefault: false,
        });
      }).toThrow('Duplicate feature ID: "custom.feature"');
    });

    it("silently ignores setEnabled for unknown features", () => {
      const registry = new FeatureRegistry();

      expect(() => {
        registry.setEnabled("unknown.feature", true);
      }).not.toThrow();

      expect(registry.isEnabled("unknown.feature")).toBe(false);
    });
  });
});
