import type { PluginSource } from "./types";

export type SettingsPageKind = "single" | "split";

export type SettingsPageGroup =
  | "appearance"
  | "projects"
  | "general"
  | "opencode"
  | "git"
  | "skills"
  | "usage"
  | "advanced";

export interface SettingsRuntimeContext {
  isVSCode: boolean;
  isWeb: boolean;
  isDesktop: boolean;
}

export interface SettingsPageContribution {
  type: "settingsPage";
  slug: string;
  title: string;
  group: SettingsPageGroup;
  kind: SettingsPageKind;
  description?: string;
  keywords?: string[];
  icon?: React.ComponentType<{ className?: string }> | null;
  isAvailable?: (ctx: SettingsRuntimeContext) => boolean;
  renderSidebar?: React.ComponentType<{ onItemSelect?: () => void }>;
  renderContent: React.ComponentType;
  pluginId: string;
  source: PluginSource;
  priority: number;
  featureId?: string;
  isCore: boolean;
}

export interface SettingsPageConfig {
  title: string;
  group: SettingsPageGroup;
  kind?: SettingsPageKind;
  description?: string;
  keywords?: string[];
  icon?: React.ComponentType<{ className?: string }> | null;
  isAvailable?: (ctx: SettingsRuntimeContext) => boolean;
  renderSidebar?: React.ComponentType<{ onItemSelect?: () => void }>;
  renderContent: React.ComponentType;
  priority?: number;
  featureId?: string;
  isCore?: boolean;
}

export interface SettingsPageContributionRecord {
  slug: string;
  pluginId: string;
  source: PluginSource;
  priority: number;
  data: SettingsPageContribution;
}
