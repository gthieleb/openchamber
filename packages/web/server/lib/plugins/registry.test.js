import { describe, it, expect, vi } from "vitest";
import {
  createServerPluginRegistry,
  createServerFeatureGate,
  ServerPluginRegistry,
  ROUTE_PHASES,
} from "./registry.js";

describe("ServerPluginRegistry", () => {
  describe("route registration", () => {
    it("registers routes with a phase", () => {
      const registry = createServerPluginRegistry();

      const register = vi.fn();
      registry.registerRoutes("test.routes", register, "test.plugin", "builtin");

      const routes = registry.getRoutesForPhase("postAuthFeatureRoutes");
      expect(routes).toHaveLength(1);
      expect(routes[0].routeId).toBe("test.routes");
      expect(routes[0].register).toBe(register);
    });

    it("defaults to postAuthFeatureRoutes phase", () => {
      const registry = createServerPluginRegistry();

      registry.registerRoutes("test.routes", vi.fn(), "test.plugin", "builtin");

      const routes = registry.getRoutesForPhase("postAuthFeatureRoutes");
      expect(routes).toHaveLength(1);
    });

    it("respects explicit phase", () => {
      const registry = createServerPluginRegistry();

      registry.registerRoutes("test.routes", vi.fn(), "test.plugin", "builtin", {
        phase: "authRoutes",
      });

      const authRoutes = registry.getRoutesForPhase("authRoutes");
      expect(authRoutes).toHaveLength(1);

      const defaultRoutes = registry.getRoutesForPhase("postAuthFeatureRoutes");
      expect(defaultRoutes).toHaveLength(0);
    });

    it("throws on unknown phase", () => {
      const registry = createServerPluginRegistry();

      expect(() => {
        registry.registerRoutes("test.routes", vi.fn(), "test.plugin", "builtin", {
          phase: "unknownPhase",
        });
      }).toThrow('Unknown route phase: "unknownPhase"');
    });

    it("sorts routes by source then priority", () => {
      const registry = createServerPluginRegistry();

      registry.registerRoutes("user.routes", vi.fn(), "user.plugin", "user", { priority: 100 });
      registry.registerRoutes("builtin.low", vi.fn(), "builtin.low", "builtin", { priority: 10 });
      registry.registerRoutes("builtin.high", vi.fn(), "builtin.high", "builtin", { priority: 100 });

      const routes = registry.getRoutesForPhase("postAuthFeatureRoutes");
      expect(routes[0].pluginId).toBe("builtin.high");
      expect(routes[1].pluginId).toBe("builtin.low");
      expect(routes[2].pluginId).toBe("user.plugin");
    });
  });

  describe("middleware registration", () => {
    it("registers middleware with a phase", () => {
      const registry = createServerPluginRegistry();

      const middleware = vi.fn();
      registry.registerMiddleware("test.middleware", middleware, "test.plugin", "builtin");

      const middlewares = registry.getMiddlewaresForPhase("earlyMiddleware");
      expect(middlewares).toHaveLength(1);
      expect(middlewares[0].middlewareId).toBe("test.middleware");
    });

    it("defaults to earlyMiddleware phase", () => {
      const registry = createServerPluginRegistry();

      registry.registerMiddleware("test.middleware", vi.fn(), "test.plugin", "builtin");

      const middlewares = registry.getMiddlewaresForPhase("earlyMiddleware");
      expect(middlewares).toHaveLength(1);
    });

    it("throws on unknown phase", () => {
      const registry = createServerPluginRegistry();

      expect(() => {
        registry.registerMiddleware("test.middleware", vi.fn(), "test.plugin", "builtin", {
          phase: "unknownPhase",
        });
      }).toThrow('Unknown middleware phase: "unknownPhase"');
    });
  });

  describe("lifecycle hooks", () => {
    it("registers and executes lifecycle hooks", async () => {
      const registry = createServerPluginRegistry();
      const calls = [];

      registry.registerLifecycle("beforeListen", () => {
        calls.push("before-1");
      }, "test.plugin-a");

      registry.registerLifecycle("beforeListen", () => {
        calls.push("before-2");
      }, "test.plugin-b");

      await registry.executeLifecycle("beforeListen");

      expect(calls).toEqual(["before-1", "before-2"]);
    });

    it("supports async lifecycle hooks", async () => {
      const registry = createServerPluginRegistry();
      const calls = [];

      registry.registerLifecycle("afterListen", async () => {
        await Promise.resolve();
        calls.push("async");
      }, "test.plugin");

      await registry.executeLifecycle("afterListen");

      expect(calls).toEqual(["async"]);
    });

    it("throws on unknown lifecycle hook", () => {
      const registry = createServerPluginRegistry();

      expect(() => {
        registry.registerLifecycle("unknownHook", () => {}, "test.plugin");
      }).toThrow('Unknown lifecycle hook: "unknownHook"');
    });

    it("propagates errors from lifecycle hooks", async () => {
      const registry = createServerPluginRegistry();

      registry.registerLifecycle("beforeShutdown", () => {
        throw new Error("shutdown failed");
      }, "test.plugin");

      await expect(
        registry.executeLifecycle("beforeShutdown"),
      ).rejects.toThrow("shutdown failed");
    });
  });

  describe("feature filtering", () => {
    it("filters routes by enabled features", () => {
      const registry = createServerPluginRegistry();

      registry.registerRoutes("terminal.routes", vi.fn(), "test.plugin", "builtin", {
        featureId: "openchamber.feature.terminal",
      });

      registry.registerRoutes("git.routes", vi.fn(), "test.plugin", "builtin", {
        featureId: "openchamber.feature.git",
      });

      const enabled = registry.getRoutesForPhase("postAuthFeatureRoutes", {
        enabledFeatures: new Set(["openchamber.feature.terminal"]),
      });
      expect(enabled).toHaveLength(1);
      expect(enabled[0].routeId).toBe("terminal.routes");
    });

    it("filters middleware by enabled features", () => {
      const registry = createServerPluginRegistry();

      registry.registerMiddleware("terminal.middleware", vi.fn(), "test.plugin", "builtin", {
        featureId: "openchamber.feature.terminal",
      });

      const disabled = registry.getMiddlewaresForPhase("earlyMiddleware", {
        enabledFeatures: new Set(),
      });
      expect(disabled).toHaveLength(0);
    });

    it("contributions without featureId are always included", () => {
      const registry = createServerPluginRegistry();

      registry.registerRoutes("core.routes", vi.fn(), "test.plugin", "builtin");

      const routes = registry.getRoutesForPhase("postAuthFeatureRoutes", {
        enabledFeatures: new Set(),
      });
      expect(routes).toHaveLength(1);
    });
  });

  describe("plugin filtering", () => {
    it("filters routes by enabled plugins", () => {
      const registry = createServerPluginRegistry();

      registry.registerRoutes("plugin-a.routes", vi.fn(), "plugin-a", "builtin");
      registry.registerRoutes("plugin-b.routes", vi.fn(), "plugin-b", "builtin");

      const enabled = registry.getRoutesForPhase("postAuthFeatureRoutes", {
        enabledPlugins: new Set(["plugin-a"]),
      });
      expect(enabled).toHaveLength(1);
      expect(enabled[0].pluginId).toBe("plugin-a");
    });
  });

  describe("contributions", () => {
    it("tracks all contributions", () => {
      const registry = createServerPluginRegistry();

      registry.registerRoutes("test.routes", vi.fn(), "test.plugin", "builtin");
      registry.registerMiddleware("test.middleware", vi.fn(), "test.plugin", "builtin");

      expect(registry.getContributionCount()).toBe(2);
    });

    it("sorts contributions by phase then priority", () => {
      const registry = createServerPluginRegistry();

      registry.registerRoutes("late.routes", vi.fn(), "test.plugin", "builtin", {
        phase: "postProxyRoutes",
        priority: 10,
      });
      registry.registerRoutes("early.routes", vi.fn(), "test.plugin", "builtin", {
        phase: "authRoutes",
        priority: 100,
      });

      const contributions = registry.getAllContributions();
      expect(contributions[0].phase).toBe("authRoutes");
      expect(contributions[1].phase).toBe("postProxyRoutes");
    });
  });

  describe("route phases", () => {
    it("exposes all route phases", () => {
      expect(ROUTE_PHASES).toHaveLength(17);
      expect(ROUTE_PHASES[0]).toBe("beforeExpress");
      expect(ROUTE_PHASES[ROUTE_PHASES.length - 1]).toBe("afterShutdown");
    });
  });
});

describe("createServerFeatureGate", () => {
  it("returns 503 for disabled features", () => {
    const featureRegistry = {
      isKnown: () => true,
      isEnabled: () => false,
    };
    const gate = createServerFeatureGate(featureRegistry);
    const middleware = gate("openchamber.feature.plan-mode");

    const req = {};
    const res = {
      status: (code) => {
        expect(code).toBe(503);
        return {
          json: (body) => {
            expect(body.error).toBe("Feature disabled");
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
    const featureRegistry = {
      isKnown: () => true,
      isEnabled: () => true,
    };
    const gate = createServerFeatureGate(featureRegistry);
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

  it("calls next when feature registry is not provided", () => {
    const gate = createServerFeatureGate(null);
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
    const featureRegistry = {
      isKnown: () => false,
      isEnabled: () => false,
    };
    const gate = createServerFeatureGate(featureRegistry);
    const middleware = gate("unknown.feature");

    const req = {};
    const res = {
      status: (code) => {
        expect(code).toBe(404);
        return {
          json: (body) => {
            expect(body.error).toBe("Feature not found");
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
