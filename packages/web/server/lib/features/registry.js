const BUILTIN_FEATURES = [
  {
    id: "openchamber.feature.terminal",
    name: "Terminal",
    description: "Terminal and PTY support",
    enabledByDefault: true,
  },
  {
    id: "openchamber.feature.files",
    name: "Files",
    description: "File browser and editor",
    enabledByDefault: true,
  },
  {
    id: "openchamber.feature.git",
    name: "Git",
    description: "Git integration",
    enabledByDefault: true,
  },
  {
    id: "openchamber.feature.plan-mode",
    name: "Plan Mode",
    description: "Plan mode for structured task planning",
    enabledByDefault: false,
  },
  {
    id: "openchamber.feature.github",
    name: "GitHub",
    description: "GitHub authentication and repository integration",
    enabledByDefault: true,
  },
  {
    id: "openchamber.feature.chat",
    name: "Chat",
    description: "Core chat interface",
    enabledByDefault: true,
  },
  {
    id: "openchamber.feature.hello-world",
    name: "Hello World",
    description: "Demo plugin to test the plugin architecture",
    enabledByDefault: true,
  },
];

export class FeatureRegistry {
  constructor() {
    this.definitions = new Map();
    this.overrides = new Map();
  }

  register(def) {
    if (this.definitions.has(def.id)) {
      throw new Error(`Duplicate feature ID: "${def.id}"`);
    }
    this.definitions.set(def.id, def);
  }

  setEnabled(id, enabled) {
    if (!this.definitions.has(id)) {
      return;
    }
    this.overrides.set(id, enabled);
  }

  isEnabled(id) {
    const def = this.definitions.get(id);
    if (!def) {
      return false;
    }
    if (this.overrides.has(id)) {
      return this.overrides.get(id);
    }
    return def.enabledByDefault;
  }

  isKnown(id) {
    return this.definitions.has(id);
  }

  getFeature(id) {
    const def = this.definitions.get(id);
    if (!def) {
      return undefined;
    }
    const overridden = this.overrides.has(id);
    return {
      id: def.id,
      name: def.name,
      description: def.description,
      enabled: this.isEnabled(id),
      enabledByDefault: def.enabledByDefault,
      pluginId: def.pluginId,
      overridden,
    };
  }

  getSnapshot() {
    const features = [];

    for (const def of this.definitions.values()) {
      const overridden = this.overrides.has(def.id);
      features.push({
        id: def.id,
        name: def.name,
        description: def.description,
        enabled: this.isEnabled(def.id),
        enabledByDefault: def.enabledByDefault,
        pluginId: def.pluginId,
        overridden,
      });
    }

    return {
      features,
      updatedAt: new Date().toISOString(),
    };
  }

  getAll() {
    return this.getSnapshot().features;
  }

  registerBuiltins() {
    for (const def of BUILTIN_FEATURES) {
      this.register(def);
    }
  }
}

export function createFeatureRegistry() {
  const registry = new FeatureRegistry();
  registry.registerBuiltins();
  return registry;
}

export function createFeatureGate(registry) {
  return function featureGate(featureId) {
    return function(req, res, next) {
      if (!registry.isKnown(featureId)) {
        return res.status(404).json({
          error: "Feature not found",
          featureId,
        });
      }
      if (!registry.isEnabled(featureId)) {
        return res.status(503).json({
          error: "Feature disabled",
          featureId,
        });
      }
      next();
    };
  };
}

export { BUILTIN_FEATURES };
