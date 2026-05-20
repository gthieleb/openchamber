import type { PluginSource } from "./types";

export interface BottomDockSurfaceConfig {
  label: string;
  render: React.ComponentType;
  priority?: number;
  featureId?: string;
  isCore?: boolean;
}

export interface BottomDockSurfaceContribution {
  type: "bottomDock";
  surfaceId: string;
  label: string;
  render: React.ComponentType;
  pluginId: string;
  source: PluginSource;
  priority: number;
  featureId?: string;
  isCore: boolean;
}

export interface BottomDockSurfaceContributionRecord {
  surfaceId: string;
  pluginId: string;
  source: PluginSource;
  priority: number;
  data: BottomDockSurfaceContribution;
}
