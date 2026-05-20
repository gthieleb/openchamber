import type { PluginSource } from "./types";

export type PluginStorageScope = "global" | "workspace";

export interface PluginStorageQuota {
  maxEntries: number;
  maxBytes: number;
}

export const DEFAULT_GLOBAL_QUOTA: PluginStorageQuota = {
  maxEntries: 1000,
  maxBytes: 10 * 1024 * 1024, // 10MB
};

export const DEFAULT_WORKSPACE_QUOTA: PluginStorageQuota = {
  maxEntries: 500,
  maxBytes: 5 * 1024 * 1024, // 5MB
};

export interface PluginStorageConfig {
  scope: PluginStorageScope;
  quota?: PluginStorageQuota;
  schemaVersion?: number;
  sensitive?: boolean;
}

export interface PluginStorageContribution {
  type: "pluginStorage";
  pluginId: string;
  source: PluginSource;
  config: PluginStorageConfig;
}

export interface PluginStorageContributionRecord {
  pluginId: string;
  source: PluginSource;
  config: PluginStorageConfig;
  data: PluginStorageContribution;
}

export interface PluginSettingsSchemaConfig {
  schema: Record<string, unknown>;
  defaults?: Record<string, unknown>;
  version?: number;
  migrate?: (fromVersion: number, data: Record<string, unknown>) => Record<string, unknown>;
}

export interface PluginSettingsSchemaContribution {
  type: "pluginSettingsSchema";
  pluginId: string;
  source: PluginSource;
  schema: Record<string, unknown>;
  defaults: Record<string, unknown>;
  version: number;
  migrate?: (fromVersion: number, data: Record<string, unknown>) => Record<string, unknown>;
}

export interface PluginSettingsSchemaContributionRecord {
  pluginId: string;
  source: PluginSource;
  schema: Record<string, unknown>;
  defaults: Record<string, unknown>;
  version: number;
  data: PluginSettingsSchemaContribution;
}
