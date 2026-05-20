import type { PluginSource } from "./types";
import type {
  PluginStorageConfig,
  PluginStorageContribution,
  PluginStorageContributionRecord,
  PluginSettingsSchemaConfig,
  PluginSettingsSchemaContribution,
  PluginSettingsSchemaContributionRecord,
} from "./plugin-storage-types";

const SOURCE_ORDER: Record<PluginSource, number> = {
  builtin: 0,
  bundled: 1,
  user: 2,
};

export class PluginStorageRegistry {
  private storageConfigs = new Map<string, PluginStorageContribution>();
  private storageRecords: PluginStorageContributionRecord[] = [];
  private settingsSchemas = new Map<string, PluginSettingsSchemaContribution>();
  private settingsSchemaRecords: PluginSettingsSchemaContributionRecord[] = [];

  registerStorage(
    pluginId: string,
    config: PluginStorageConfig,
    source: PluginSource,
  ): void {
    if (this.storageConfigs.has(pluginId)) {
      throw new Error(`Duplicate storage registration for plugin "${pluginId}"`);
    }

    const contribution: PluginStorageContribution = {
      type: "pluginStorage",
      pluginId,
      source,
      config,
    };

    this.storageConfigs.set(pluginId, contribution);
    this.storageRecords.push({
      pluginId,
      source,
      config,
      data: contribution,
    });
  }

  registerSettingsSchema(
    pluginId: string,
    config: PluginSettingsSchemaConfig,
    source: PluginSource,
  ): void {
    if (this.settingsSchemas.has(pluginId)) {
      throw new Error(`Duplicate settings schema registration for plugin "${pluginId}"`);
    }

    const contribution: PluginSettingsSchemaContribution = {
      type: "pluginSettingsSchema",
      pluginId,
      source,
      schema: config.schema,
      defaults: config.defaults ?? {},
      version: config.version ?? 1,
      migrate: config.migrate,
    };

    this.settingsSchemas.set(pluginId, contribution);
    this.settingsSchemaRecords.push({
      pluginId,
      source,
      schema: config.schema,
      defaults: config.defaults ?? {},
      version: config.version ?? 1,
      data: contribution,
    });
  }

  getStorageConfig(pluginId: string): PluginStorageConfig | undefined {
    return this.storageConfigs.get(pluginId)?.config;
  }

  getSettingsSchema(pluginId: string): PluginSettingsSchemaContribution | undefined {
    return this.settingsSchemas.get(pluginId);
  }

  getAllStorageConfigs(): PluginStorageContribution[] {
    return Array.from(this.storageConfigs.values()).sort((a, b) => {
      const sourceDiff = SOURCE_ORDER[a.source] - SOURCE_ORDER[b.source];
      if (sourceDiff !== 0) return sourceDiff;
      return 0;
    });
  }

  getAllSettingsSchemas(): PluginSettingsSchemaContribution[] {
    return Array.from(this.settingsSchemas.values()).sort((a, b) => {
      const sourceDiff = SOURCE_ORDER[a.source] - SOURCE_ORDER[b.source];
      if (sourceDiff !== 0) return sourceDiff;
      return 0;
    });
  }

  getAllRecords(): {
    storage: PluginStorageContributionRecord[];
    settingsSchemas: PluginSettingsSchemaContributionRecord[];
  } {
    return {
      storage: [...this.storageRecords].sort((a, b) => {
        const sourceDiff = SOURCE_ORDER[a.source] - SOURCE_ORDER[b.source];
        if (sourceDiff !== 0) return sourceDiff;
        return 0;
      }),
      settingsSchemas: [...this.settingsSchemaRecords].sort((a, b) => {
        const sourceDiff = SOURCE_ORDER[a.source] - SOURCE_ORDER[b.source];
        if (sourceDiff !== 0) return sourceDiff;
        return 0;
      }),
    };
  }

  getContributionCount(): number {
    return this.storageRecords.length + this.settingsSchemaRecords.length;
  }

  unregisterPlugin(pluginId: string): void {
    this.storageConfigs.delete(pluginId);
    this.storageRecords = this.storageRecords.filter((r) => r.pluginId !== pluginId);
    this.settingsSchemas.delete(pluginId);
    this.settingsSchemaRecords = this.settingsSchemaRecords.filter((r) => r.pluginId !== pluginId);
  }
}

export function getQuotaForScope(scope: "global" | "workspace"): { maxEntries: number; maxBytes: number } {
  if (scope === "global") {
    return { maxEntries: 1000, maxBytes: 10 * 1024 * 1024 };
  }
  return { maxEntries: 500, maxBytes: 5 * 1024 * 1024 };
}
