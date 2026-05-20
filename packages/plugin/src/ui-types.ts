import type { ComponentType, ReactNode } from "react";

export type UIContributionType = "fill" | "surface" | "replace" | "wrap" | "slot";

export interface UIFillContribution {
  type: "fill";
  slotId: string;
  component: ComponentType<unknown> | (() => ReactNode);
  priority: number;
  pluginId: string;
  featureId?: string;
}

export interface UISurfaceContribution {
  type: "surface";
  surfaceId: string;
  title: string;
  placements: string[];
  render: ComponentType<unknown>;
  pluginId: string;
  featureId?: string;
}

export interface UIReplaceContribution {
  type: "replace";
  targetId: string;
  component: ComponentType<unknown>;
  priority: number;
  pluginId: string;
  featureId?: string;
}

export interface UIWrapContribution {
  type: "wrap";
  targetId: string;
  wrapper: (props: { children: ReactNode }) => ReactNode;
  priority: number;
  pluginId: string;
  featureId?: string;
}

export interface UISlotContribution {
  type: "slot";
  slotId: string;
  render: ComponentType<unknown>;
  pluginId: string;
  featureId?: string;
}

export type UIContribution =
  | UIFillContribution
  | UISurfaceContribution
  | UIReplaceContribution
  | UIWrapContribution
  | UISlotContribution;

export interface UIContributionOptions {
  priority?: number;
  featureId?: string;
}

export interface UISurfaceConfig {
  title: string;
  placements: string[];
  render: ComponentType<unknown>;
  featureId?: string;
}

export interface UIReplacementConfig {
  component: ComponentType<unknown>;
  priority?: number;
  featureId?: string;
}

export interface UIWrapConfig {
  wrapper: (props: { children: ReactNode }) => ReactNode;
  priority?: number;
  featureId?: string;
}

export interface UISlotConfig {
  render: ComponentType<unknown>;
  priority?: number;
  featureId?: string;
}

export interface UIContributionRecord {
  type: UIContributionType;
  id: string;
  pluginId: string;
  source: string;
  priority: number;
  data: UIContribution;
}
