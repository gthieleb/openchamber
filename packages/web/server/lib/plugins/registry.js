const ROUTE_PHASES = [
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

export class ServerPluginRegistry {
  constructor() {
    this.routes = new Map();
    this.middlewares = new Map();
    this.lifecycleHooks = new Map();
    this.contributions = [];
    this.routeConflicts = new Map();
  }

  registerRoutes(routeId, register, pluginId, source, options = {}) {
    const phase = options.phase ?? "postAuthFeatureRoutes";
    if (!ROUTE_PHASES.includes(phase)) {
      throw new Error(
        `Unknown route phase: "${phase}". Valid phases: ${ROUTE_PHASES.join(", ")}`,
      );
    }

    const entry = {
      routeId,
      register,
      pluginId,
      source,
      phase,
      featureId: options.featureId,
      priority: options.priority ?? 0,
    };

    const phaseRoutes = this.routes.get(phase) ?? [];
    phaseRoutes.push(entry);
    this.routes.set(phase, phaseRoutes);

    this.contributions.push({
      type: "server.route",
      id: routeId,
      pluginId,
      source,
      phase,
      priority: entry.priority,
    });
  }

  registerMiddleware(middlewareId, middleware, pluginId, source, options = {}) {
    const phase = options.phase ?? "earlyMiddleware";
    if (!ROUTE_PHASES.includes(phase)) {
      throw new Error(
        `Unknown middleware phase: "${phase}". Valid phases: ${ROUTE_PHASES.join(", ")}`,
      );
    }

    const entry = {
      middlewareId,
      middleware,
      pluginId,
      source,
      phase,
      featureId: options.featureId,
      priority: options.priority ?? 0,
    };

    const phaseMiddlewares = this.middlewares.get(phase) ?? [];
    phaseMiddlewares.push(entry);
    this.middlewares.set(phase, phaseMiddlewares);

    this.contributions.push({
      type: "server.middleware",
      id: middlewareId,
      pluginId,
      source,
      phase,
      priority: entry.priority,
    });
  }

  registerLifecycle(hook, fn, pluginId) {
    if (!ROUTE_PHASES.includes(hook)) {
      throw new Error(
        `Unknown lifecycle hook: "${hook}". Valid hooks: ${ROUTE_PHASES.join(", ")}`,
      );
    }

    const hooks = this.lifecycleHooks.get(hook) ?? [];
    hooks.push({ fn, pluginId });
    this.lifecycleHooks.set(hook, hooks);
  }

  async executeLifecycle(hook, context) {
    const hooks = this.lifecycleHooks.get(hook) ?? [];
    for (const { fn, pluginId } of hooks) {
      try {
        await fn(context);
      } catch (error) {
        console.error(
          `[ServerPluginRegistry] Lifecycle hook "${hook}" failed for plugin "${pluginId}":`,
          error?.message || error,
        );
        throw error;
      }
    }
  }

  getRoutesForPhase(phase, filters = {}) {
    const routes = this.routes.get(phase) ?? [];
    return this.filterContributions(routes, filters);
  }

  getMiddlewaresForPhase(phase, filters = {}) {
    const middlewares = this.middlewares.get(phase) ?? [];
    return this.filterContributions(middlewares, filters);
  }

  getAllContributions() {
    return [...this.contributions].sort((a, b) => {
      const phaseDiff = ROUTE_PHASES.indexOf(a.phase) - ROUTE_PHASES.indexOf(b.phase);
      if (phaseDiff !== 0) return phaseDiff;
      return a.priority - b.priority;
    });
  }

  getContributionCount() {
    return this.contributions.length;
  }

  getRoutePhases() {
    return [...ROUTE_PHASES];
  }

  filterContributions(contributions, filters) {
    let filtered = contributions;

    if (filters.enabledFeatures) {
      filtered = filtered.filter(
        (c) => !c.featureId || filters.enabledFeatures.has(c.featureId),
      );
    }

    if (filters.enabledPlugins) {
      filtered = filtered.filter((c) => filters.enabledPlugins.has(c.pluginId));
    }

    return [...filtered].sort((a, b) => {
      const sourceOrder = { builtin: 0, bundled: 1, user: 2 };
      const sourceA = a.source ?? "builtin";
      const sourceB = b.source ?? "builtin";
      const sourceDiff = sourceOrder[sourceA] - sourceOrder[sourceB];
      if (sourceDiff !== 0) return sourceDiff;
      return b.priority - a.priority;
    });
  }
}

export function createServerPluginRegistry() {
  return new ServerPluginRegistry();
}

export function createServerFeatureGate(featureRegistry) {
  return function serverFeatureGate(featureId) {
    return function(req, res, next) {
      if (!featureRegistry) {
        return next();
      }
      if (!featureRegistry.isKnown(featureId)) {
        return res.status(404).json({
          error: "Feature not found",
          featureId,
        });
      }
      if (!featureRegistry.isEnabled(featureId)) {
        return res.status(503).json({
          error: "Feature disabled",
          featureId,
        });
      }
      next();
    };
  };
}

export { ROUTE_PHASES };
