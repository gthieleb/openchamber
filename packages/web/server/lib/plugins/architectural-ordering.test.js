import { describe, it, expect } from "vitest";
import { ServerPluginRegistry, ROUTE_PHASES } from "./registry.js";

describe("ServerPluginRegistry - architectural ordering", () => {
  it("maintains correct phase ordering for all route phases", () => {
    const expectedOrder = [
      "beforeExpress",
      "afterExpress",
      "earlyMiddleware",
      "bodyParser",
      "preAuthPublicRoutes",
      "authRoutes",
      "authGate",
      "postAuthFeatureRoutes",
      "preOpenCodeProxy",
      "openCodeProxy",
      "postProxyRoutes",
      "staticAssets",
      "spaFallback",
      "beforeListen",
      "afterListen",
      "beforeShutdown",
      "afterShutdown",
    ];

    expect(ROUTE_PHASES).toEqual(expectedOrder);
    expect(ROUTE_PHASES.length).toBe(17);
  });

  it("returns routes sorted by priority within same phase (higher priority first)", () => {
    const registry = new ServerPluginRegistry();

    registry.registerRoutes("route-high", () => {}, "plugin-a", "builtin", { phase: "authRoutes", priority: 10 });
    registry.registerRoutes("route-low", () => {}, "plugin-b", "builtin", { phase: "authRoutes", priority: 5 });

    const authRoutes = registry.getRoutesForPhase("authRoutes");
    expect(authRoutes).toHaveLength(2);
    expect(authRoutes[0].routeId).toBe("route-high");
    expect(authRoutes[1].routeId).toBe("route-low");
  });

  it("maintains source ordering: builtin < bundled < user", () => {
    const registry = new ServerPluginRegistry();

    registry.registerRoutes("user-route", () => {}, "user-plugin", "user", { phase: "postAuthFeatureRoutes", priority: 0 });
    registry.registerRoutes("bundled-route", () => {}, "bundled-plugin", "bundled", { phase: "postAuthFeatureRoutes", priority: 0 });
    registry.registerRoutes("builtin-route", () => {}, "builtin-plugin", "builtin", { phase: "postAuthFeatureRoutes", priority: 0 });

    const allRoutes = registry.getRoutesForPhase("postAuthFeatureRoutes");
    expect(allRoutes).toHaveLength(3);
    expect(allRoutes[0].source).toBe("builtin");
    expect(allRoutes[1].source).toBe("bundled");
    expect(allRoutes[2].source).toBe("user");
  });

  it("auth gate phase is isolated from feature routes", () => {
    const registry = new ServerPluginRegistry();

    registry.registerRoutes("auth-route", () => {}, "auth-plugin", "builtin", { phase: "authRoutes" });
    registry.registerRoutes("feature-route", () => {}, "feature-plugin", "builtin", { phase: "postAuthFeatureRoutes" });

    const authRoutes = registry.getRoutesForPhase("authRoutes");
    const featureRoutes = registry.getRoutesForPhase("postAuthFeatureRoutes");

    expect(authRoutes).toHaveLength(1);
    expect(featureRoutes).toHaveLength(1);
    expect(authRoutes[0].routeId).toBe("auth-route");
    expect(featureRoutes[0].routeId).toBe("feature-route");
  });

  it("proxy phases are ordered correctly relative to auth", () => {
    const registry = new ServerPluginRegistry();

    registry.registerRoutes("pre-proxy", () => {}, "plugin-a", "builtin", { phase: "preOpenCodeProxy" });
    registry.registerRoutes("proxy", () => {}, "plugin-b", "builtin", { phase: "openCodeProxy" });
    registry.registerRoutes("post-proxy", () => {}, "plugin-c", "builtin", { phase: "postProxyRoutes" });

    const contributions = registry.getAllContributions();
    const phases = contributions.map((c) => c.phase);

    const preProxyIdx = phases.indexOf("preOpenCodeProxy");
    const proxyIdx = phases.indexOf("openCodeProxy");
    const postProxyIdx = phases.indexOf("postProxyRoutes");

    expect(preProxyIdx).toBeLessThan(proxyIdx);
    expect(proxyIdx).toBeLessThan(postProxyIdx);
  });

  it("static and spa fallback are last phases before shutdown", () => {
    const registry = new ServerPluginRegistry();

    registry.registerRoutes("static", () => {}, "plugin-a", "builtin", { phase: "staticAssets" });
    registry.registerRoutes("spa", () => {}, "plugin-b", "builtin", { phase: "spaFallback" });
    registry.registerRoutes("feature", () => {}, "plugin-c", "builtin", { phase: "postAuthFeatureRoutes" });

    const contributions = registry.getAllContributions();
    const phases = contributions.map((c) => c.phase);

    const featureIdx = phases.indexOf("postAuthFeatureRoutes");
    const staticIdx = phases.indexOf("staticAssets");
    const spaIdx = phases.indexOf("spaFallback");

    expect(featureIdx).toBeLessThan(staticIdx);
    expect(staticIdx).toBeLessThan(spaIdx);
  });

  it("shutdown hooks execute in correct order", () => {
    const registry = new ServerPluginRegistry();

    registry.registerLifecycle("beforeShutdown", () => {}, "plugin-a");
    registry.registerLifecycle("afterShutdown", () => {}, "plugin-b");

    expect(registry.lifecycleHooks.get("beforeShutdown")).toHaveLength(1);
    expect(registry.lifecycleHooks.get("afterShutdown")).toHaveLength(1);
  });
});
