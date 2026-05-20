import type { ComponentType, ReactNode } from "react";
import type { PluginSource } from "./types";

export type ContextPanelRendererType = "contextPanelRenderer";

export interface ContextPanelRendererContribution {
  type: "contextPanelRenderer";
  mode: string;
  label: string;
  icon?: ComponentType<unknown> | (() => ReactNode);
  render: ComponentType<unknown>;
  pluginId: string;
  source: PluginSource;
  priority: number;
  featureId?: string;
  isCore?: boolean;
}

export interface ContextPanelRendererConfig {
  label: string;
  icon?: ComponentType<unknown> | (() => ReactNode);
  render: ComponentType<unknown>;
  priority?: number;
  featureId?: string;
  isCore?: boolean;
}

export interface ContextPanelRendererRecord {
  mode: string;
  pluginId: string;
  source: PluginSource;
  priority: number;
  data: ContextPanelRendererContribution;
}
