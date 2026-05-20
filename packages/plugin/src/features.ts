export type FeatureId =
  | "openchamber.feature.terminal"
  | "openchamber.feature.files"
  | "openchamber.feature.git"
  | "openchamber.feature.plan-mode"
  | (string & {});

export interface FeatureDefinition {
  id: FeatureId;
  name: string;
  description?: string;
  enabledByDefault: boolean;
  pluginId?: string;
}

export interface FeatureEntry {
  id: FeatureId;
  name: string;
  description?: string;
  enabled: boolean;
  enabledByDefault: boolean;
  pluginId?: string;
  overridden: boolean;
}

export interface FeatureSnapshot {
  features: FeatureEntry[];
  updatedAt: string;
}
