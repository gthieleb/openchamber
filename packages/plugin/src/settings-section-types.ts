import type { PluginSource } from "./types";
import type { SettingsRuntimeContext } from "./settings-types";

export interface SettingsSectionConfig {
  title: string;
  description?: string;
  renderContent: React.ComponentType;
  priority?: number;
  featureId?: string;
  isAvailable?: (ctx: SettingsRuntimeContext) => boolean;
}

export interface SettingsSectionContribution {
  type: "settingsSection";
  pageSlug: string;
  sectionId: string;
  title: string;
  description?: string;
  renderContent: React.ComponentType;
  pluginId: string;
  source: PluginSource;
  priority: number;
  featureId?: string;
  isAvailable?: (ctx: SettingsRuntimeContext) => boolean;
}

export interface SettingsSectionContributionRecord {
  pageSlug: string;
  sectionId: string;
  pluginId: string;
  source: PluginSource;
  priority: number;
  data: SettingsSectionContribution;
}
