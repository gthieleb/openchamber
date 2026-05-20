import type { PluginSource } from "./types";

export type CommandGroup =
  | "session"
  | "navigation"
  | "settings"
  | "view"
  | "git"
  | "terminal"
  | "files"
  | "general";

export interface CommandContribution {
  type: "command";
  id: string;
  title: string;
  group: CommandGroup;
  icon?: React.ComponentType<{ className?: string }> | React.ReactNode;
  shortcutId?: string;
  keywords?: string[];
  isAvailable?: () => boolean;
  run: () => void | Promise<void>;
  pluginId: string;
  source: PluginSource;
  priority: number;
  featureId?: string;
  isCore: boolean;
}

export interface CommandConfig {
  title: string;
  group: CommandGroup;
  icon?: React.ComponentType<{ className?: string }> | React.ReactNode;
  shortcutId?: string;
  keywords?: string[];
  isAvailable?: () => boolean;
  run: () => void | Promise<void>;
  priority?: number;
  featureId?: string;
  isCore?: boolean;
}

export interface CommandContributionRecord {
  id: string;
  pluginId: string;
  source: PluginSource;
  priority: number;
  data: CommandContribution;
}
