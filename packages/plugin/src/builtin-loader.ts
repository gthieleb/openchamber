import type {
  DefinedPlugin,
  PluginDefinition,
  PluginCapability,
  PluginTarget,
  PluginContext,
  PluginDiagnostics,
} from "./types";
import type { FeatureRegistry } from "./feature-registry";
import type { UIContributionRegistry } from "./ui-registry";
import type { UISurfaceConfig as UISurfaceConfigType } from "./ui-types";

export interface BuiltinPluginEntry {
  definition: DefinedPlugin | PluginDefinition;
  enabledByDefault?: boolean;
}

export interface BuiltinLoaderConfig {
  target: PluginTarget;
  enabledPlugins?: Set<string>;
  disabledPlugins?: Set<string>;
  featureRegistry?: FeatureRegistry;
  uiRegistry?: UIContributionRegistry;
  createUIAPI: (pluginId: string) => {
    fill: (slotId: string, component: unknown, options?: { priority?: number }) => void;
    surface: (surfaceId: string, config: UISurfaceConfigType) => void;
    slot: (slotId: string, config: { render: unknown; featureId?: string }) => void;
    replace: (targetId: string, component: unknown, options?: { priority?: number }) => void;
    wrap: (targetId: string, wrapper: unknown, options?: { priority?: number }) => void;
  };
  createCommandsAPI: (pluginId: string) => {
    register: (commandId: string, config: { title: string; run: (...args: unknown[]) => unknown }) => void;
  };
  createSettingsAPI: (pluginId: string) => {
    page: (pageId: string, config: { title: string; render: unknown }) => void;
    section: (pageId: string, sectionId: string, config: { title: string; render: unknown }) => void;
  };
  createStorageAPI: (pluginId: string) => {
    get: <T>(key: string) => T | undefined;
    set: <T>(key: string, value: T) => void;
    delete: (key: string) => void;
  };
  createToolsAPI: (pluginId: string) => {
    registerRenderer: (toolName: string, renderer: unknown) => void;
  };
  createModelsAPI: (pluginId: string) => {
    filter: (fn: (models: unknown[]) => unknown[]) => void;
    decorate: (fn: (models: unknown[]) => unknown[]) => void;
  };
  createRuntimeAPI: (target: PluginTarget) => {
    target: PluginTarget;
    isRuntime: (t: PluginTarget) => boolean;
  };
  createServerAPI?: () => {
    routes: (routeId: string, register: (router: unknown) => void, options?: { phase?: string }) => void;
    middleware: (middlewareId: string, middleware: unknown, options?: { phase?: string }) => void;
    lifecycle: (hook: string, fn: () => void | Promise<void>) => void;
  };
}

export interface BuiltinPluginResult {
  pluginId: string;
  status: "ready" | "error" | "disabled" | "skipped";
  error?: string;
  contributionCount: number;
  grantedCapabilities: PluginCapability[];
  deniedCapabilities: PluginCapability[];
}

export interface BuiltinLoaderResult {
  plugins: BuiltinPluginResult[];
  totalContributions: number;
  errors: string[];
}

function isDefinedPlugin(
  value: DefinedPlugin | PluginDefinition,
): value is DefinedPlugin {
  return typeof value === "function" && "__definition" in value;
}

function getPluginId(entry: BuiltinPluginEntry): string {
  return isDefinedPlugin(entry.definition)
    ? entry.definition.__definition.id
    : entry.definition.id;
}

function getPluginDefinition(entry: BuiltinPluginEntry): PluginDefinition {
  return isDefinedPlugin(entry.definition)
    ? entry.definition.__definition
    : entry.definition;
}

function isPluginEnabled(
  entry: BuiltinPluginEntry,
  config: BuiltinLoaderConfig,
): boolean {
  const pluginId = getPluginId(entry);
  const def = getPluginDefinition(entry);

  if (config.disabledPlugins?.has(pluginId)) {
    return false;
  }

  if (config.enabledPlugins?.has(pluginId)) {
    return true;
  }

  if (config.enabledPlugins && config.enabledPlugins.size > 0) {
    return false;
  }

  if (entry.enabledByDefault === false) {
    return false;
  }

  return def.enabledByDefault !== false;
}

export async function loadBuiltinPlugins(
  plugins: BuiltinPluginEntry[],
  config: BuiltinLoaderConfig,
): Promise<BuiltinLoaderResult> {
  const results: BuiltinPluginResult[] = [];
  const errors: string[] = [];
  let totalContributions = 0;

  const ordered = [...plugins].sort((a, b) => {
    const defA = getPluginDefinition(a);
    const defB = getPluginDefinition(b);
    const priorityA = defA.priority ?? 0;
    const priorityB = defB.priority ?? 0;
    if (priorityA !== priorityB) return priorityA - priorityB;
    return (defA.id ?? "").localeCompare(defB.id ?? "");
  });

  for (const entry of ordered) {
    const pluginId = getPluginId(entry);
    const def = getPluginDefinition(entry);

    if (!isPluginEnabled(entry, config)) {
      results.push({
        pluginId,
        status: "disabled",
        contributionCount: 0,
        grantedCapabilities: [],
        deniedCapabilities: [],
      });
      continue;
    }

    const targets = def.targets ?? ["ui", "server"];
    if (!targets.includes(config.target)) {
      results.push({
        pluginId,
        status: "skipped",
        contributionCount: 0,
        grantedCapabilities: [],
        deniedCapabilities: [],
      });
      continue;
    }

    const capabilities = def.capabilities ?? [];
    const optionalCapabilities = def.optionalCapabilities ?? [];
    const grantedCapabilities = [...capabilities, ...optionalCapabilities];
    const deniedCapabilities: PluginCapability[] = [];

    try {
      const ctx: PluginContext = {
        manifest: {
          id: def.id,
          name: def.name,
          version: def.version,
          description: def.description,
          source: "builtin",
          targets,
          capabilities,
          optionalCapabilities,
          priority: def.priority ?? 0,
          required: def.required ?? false,
        },
        capabilities: {
          granted: grantedCapabilities,
          denied: deniedCapabilities,
          has: (cap: PluginCapability) =>
            grantedCapabilities.includes(cap) && !deniedCapabilities.includes(cap),
        },
        ui: config.createUIAPI(def.id),
        commands: config.createCommandsAPI(def.id),
        settings: config.createSettingsAPI(def.id),
        storage: config.createStorageAPI(def.id),
        tools: config.createToolsAPI(def.id),
        models: config.createModelsAPI(def.id),
        runtime: config.createRuntimeAPI(config.target),
      };

      if (config.createServerAPI && config.target === "server") {
        ctx.server = config.createServerAPI();
      }

      const setupFn = isDefinedPlugin(entry.definition)
        ? entry.definition
        : def.setup;

      await setupFn(ctx);

      const contributionCount = config.uiRegistry
        ? config.uiRegistry.getContributionCount()
        : 0;

      totalContributions += contributionCount;

      results.push({
        pluginId,
        status: "ready",
        contributionCount,
        grantedCapabilities,
        deniedCapabilities,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`Plugin "${pluginId}" setup failed: ${message}`);

      results.push({
        pluginId,
        status: "error",
        error: message,
        contributionCount: 0,
        grantedCapabilities,
        deniedCapabilities,
      });

      if (def.required) {
        throw err;
      }
    }
  }

  return {
    plugins: results,
    totalContributions,
    errors,
  };
}

export function getBuiltinDiagnostics(result: BuiltinLoaderResult): PluginDiagnostics[] {
  return result.plugins.map((p) => ({
    id: p.pluginId,
    name: p.pluginId,
    version: "builtin",
    source: "builtin",
    targets: ["ui", "server"],
    status: p.status,
    grantedCapabilities: p.grantedCapabilities,
    deniedCapabilities: p.deniedCapabilities,
    contributionCount: p.contributionCount,
    contributionsByType: {},
    setupErrors: p.error ? [`Plugin "${p.pluginId}" setup failed: ${p.error}`] : [],
  }));
}
