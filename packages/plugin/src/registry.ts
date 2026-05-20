import type {
  ContributionRecord,
  DefinedPlugin,
  GrantedCapabilities,
  PluginCapability,
  PluginContext,
  PluginDefinition,
  PluginDiagnostics,
  PluginManifest,
  PluginRegistryEntry,
  PluginRuntimeAPI,
  PluginServerAPI,
  PluginSource,
  PluginTarget,
  RuntimePluginEntry,
  UISurfaceConfig,
} from "./types";
import { definePlugin } from "./types";

const SOURCE_ORDER: Record<PluginSource, number> = {
  builtin: 0,
  bundled: 1,
  user: 2,
};

export class PluginRegistry {
  private plugins = new Map<string, PluginRegistryEntry>();
  private contributions = new Map<string, ContributionRecord[]>();
  private disposables: Array<() => void> = [];

  register(
    pluginOrDef: DefinedPlugin | PluginDefinition,
    options?: {
      grantedCapabilities?: PluginCapability[];
      deniedCapabilities?: PluginCapability[];
    },
  ): void {
    const def = isDefinedPlugin(pluginOrDef)
      ? pluginOrDef.__definition
      : pluginOrDef;

    if (!def.id) {
      throw new Error("Plugin definition missing required field: id");
    }

    if (this.plugins.has(def.id)) {
      throw new Error(
        `Duplicate plugin ID: "${def.id}". Each plugin must have a unique ID.`,
      );
    }

    const manifest = normalizeManifest(def);
    const setupFn = isDefinedPlugin(pluginOrDef)
      ? pluginOrDef
      : def.setup;
    const entry: PluginRegistryEntry = {
      definition: def,
      setupFn,
      manifest,
      contributions: new Map(),
      grantedCapabilities: options?.grantedCapabilities ?? manifest.capabilities,
      deniedCapabilities: options?.deniedCapabilities ?? [],
      setupErrors: [],
      status: "pending",
      disposables: [],
    };

    this.plugins.set(def.id, entry);
  }

  async setupAll(params: {
    target: PluginTarget;
    createUIAPI: (pluginId: string) => {
      fill: (slotId: string, component: unknown, options?: { priority?: number }) => void;
      surface: (surfaceId: string, config: UISurfaceConfig) => void;
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
    createRuntimeAPI: (target: PluginTarget) => PluginRuntimeAPI;
    createServerAPI?: () => PluginServerAPI;
  }): Promise<void> {
    const ordered = this.getOrderedPlugins();

    for (const entry of ordered) {
      if (!entry.manifest.targets.includes(params.target)) {
        entry.status = "disabled";
        continue;
      }

      const capabilities = createGrantedCapabilities(
        entry.grantedCapabilities,
        entry.deniedCapabilities,
      );

      const manifest = entry.manifest;
      const runtimeAPI = params.createRuntimeAPI(params.target);

      const ctx: PluginContext = {
        manifest: toRuntimePluginEntry(manifest),
        capabilities,
        ui: params.createUIAPI(entry.manifest.id),
        commands: params.createCommandsAPI(entry.manifest.id),
        settings: params.createSettingsAPI(entry.manifest.id),
        storage: params.createStorageAPI(entry.manifest.id),
        tools: params.createToolsAPI(entry.manifest.id),
        models: params.createModelsAPI(entry.manifest.id),
        runtime: runtimeAPI,
      };

      if (params.createServerAPI && params.target === "server") {
        ctx.server = params.createServerAPI();
      }

      try {
        await entry.setupFn(ctx);
        entry.status = "ready";
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        entry.setupErrors.push(message);
        if (entry.manifest.required) {
          entry.status = "error";
          throw err;
        }
        entry.status = "error";
      }
    }
  }

  getPlugin(pluginId: string): PluginRegistryEntry | undefined {
    return this.plugins.get(pluginId);
  }

  getPlugins(): PluginRegistryEntry[] {
    return this.getOrderedPlugins();
  }

  getContributions(type: string): ContributionRecord[] {
    const records = this.contributions.get(type) ?? [];
    return sortContributions(records);
  }

  getAllContributions(): ContributionRecord[] {
    const all: ContributionRecord[] = [];
    for (const records of this.contributions.values()) {
      all.push(...records);
    }
    return sortContributions(all);
  }

  getDiagnostics(): PluginDiagnostics[] {
    const result: PluginDiagnostics[] = [];

    for (const entry of this.getOrderedPlugins()) {
      const contributionsByType: Record<string, number> = {};
      let totalCount = 0;

      for (const [type, records] of entry.contributions) {
        contributionsByType[type] = records.length;
        totalCount += records.length;
      }

      result.push({
        id: entry.manifest.id,
        name: entry.manifest.name,
        version: entry.manifest.version,
        source: entry.manifest.source,
        targets: entry.manifest.targets,
        status: entry.status,
        grantedCapabilities: entry.grantedCapabilities,
        deniedCapabilities: entry.deniedCapabilities,
        contributionCount: totalCount,
        contributionsByType,
        setupErrors: [...entry.setupErrors],
      });
    }

    return result;
  }

  addContribution(type: string, record: ContributionRecord): void {
    const existing = this.contributions.get(type) ?? [];
    existing.push(record);
    this.contributions.set(type, existing);

    const entry = this.plugins.get(record.pluginId);
    if (entry) {
      const pluginContributions = entry.contributions.get(type) ?? [];
      pluginContributions.push(record.data);
      entry.contributions.set(type, pluginContributions);
    }
  }

  addDisposable(pluginId: string, fn: () => void): void {
    const entry = this.plugins.get(pluginId);
    if (entry) {
      entry.disposables.push(fn);
    }
    this.disposables.push(fn);
  }

  async dispose(): Promise<void> {
    for (const fn of this.disposables) {
      try {
        fn();
      } catch {
        // Intentionally ignore disposal errors to ensure all disposables run.
      }
    }
    this.disposables = [];
  }

  private getOrderedPlugins(): PluginRegistryEntry[] {
    const entries = Array.from(this.plugins.values());
    entries.sort((a, b) => {
      const sourceDiff =
        SOURCE_ORDER[a.manifest.source] - SOURCE_ORDER[b.manifest.source];
      if (sourceDiff !== 0) return sourceDiff;

      const priorityDiff = (a.manifest.priority ?? 0) - (b.manifest.priority ?? 0);
      if (priorityDiff !== 0) return priorityDiff;

      return a.manifest.id.localeCompare(b.manifest.id);
    });
    return entries;
  }
}

function isDefinedPlugin(
  value: DefinedPlugin | PluginDefinition,
): value is DefinedPlugin {
  return typeof value === "function" && "__definition" in value;
}

function normalizeManifest(def: PluginDefinition): PluginManifest {
  return {
    id: def.id,
    name: def.name,
    version: def.version,
    description: def.description,
    source: def.source ?? "builtin",
    targets: def.targets ?? ["ui", "server"],
    capabilities: def.capabilities ?? [],
    optionalCapabilities: def.optionalCapabilities ?? [],
    priority: def.priority ?? 0,
    required: def.required ?? false,
  };
}

function toRuntimePluginEntry(manifest: PluginManifest): RuntimePluginEntry {
  return {
    id: manifest.id,
    name: manifest.name,
    version: manifest.version,
    description: manifest.description,
    source: manifest.source,
    targets: manifest.targets,
    capabilities: manifest.capabilities,
    optionalCapabilities: manifest.optionalCapabilities,
    priority: manifest.priority,
    required: manifest.required,
  };
}

function createGrantedCapabilities(
  granted: PluginCapability[],
  denied: PluginCapability[],
): GrantedCapabilities {
  const grantedSet = new Set(granted);
  const deniedSet = new Set(denied);

  return {
    granted,
    denied,
    has(capability: PluginCapability): boolean {
      return grantedSet.has(capability) && !deniedSet.has(capability);
    },
  };
}

function sortContributions(
  contributions: ContributionRecord[],
): ContributionRecord[] {
  return [...contributions].sort((a, b) => {
    const sourceDiff =
      SOURCE_ORDER[a.source] - SOURCE_ORDER[b.source];
    if (sourceDiff !== 0) return sourceDiff;

    const priorityDiff = a.priority - b.priority;
    if (priorityDiff !== 0) return priorityDiff;

    const pluginDiff = a.pluginId.localeCompare(b.pluginId);
    if (pluginDiff !== 0) return pluginDiff;

    return a.id.localeCompare(b.id);
  });
}

export { definePlugin };
