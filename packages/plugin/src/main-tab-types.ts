import type { ComponentType, ReactNode } from "react";
import type { PluginSource } from "./types";

export type MainTabContributionType = "mainTab";

export interface MainTabContribution {
  type: "mainTab";
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

export interface MainTabConfig {
  label: string;
  icon?: ComponentType<unknown> | (() => ReactNode);
  render: ComponentType<unknown>;
  priority?: number;
  featureId?: string;
  isCore?: boolean;
}

export interface MainTabContributionRecord {
  tabId: string;
  pluginId: string;
  source: PluginSource;
  priority: number;
  data: MainTabContribution;
}
