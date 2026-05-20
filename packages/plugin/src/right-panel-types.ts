import type { ComponentType, ReactNode } from "react";
import type { PluginSource } from "./types";

export type RightPanelContributionType = "rightPanel";

export interface RightPanelContribution {
  type: "rightPanel";
  tabId: string;
  label: string;
  icon?: ComponentType<unknown> | (() => ReactNode);
  render: ComponentType<unknown>;
  pluginId: string;
  source: PluginSource;
  priority: number;
  featureId?: string;
  isCore?: boolean;
}

export interface RightPanelConfig {
  label: string;
  icon?: ComponentType<unknown> | (() => ReactNode);
  render: ComponentType<unknown>;
  priority?: number;
  featureId?: string;
  isCore?: boolean;
}

export interface RightPanelContributionRecord {
  tabId: string;
  pluginId: string;
  source: PluginSource;
  priority: number;
  data: RightPanelContribution;
}
