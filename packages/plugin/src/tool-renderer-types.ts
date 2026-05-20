import type { PluginSource } from "./types";

export type ToolRendererMatchType = "exact" | "prefix" | "wildcard";

export interface ToolRendererProps {
  toolName: string;
  input: Record<string, unknown> | undefined;
  output: string | undefined;
  error: string | undefined;
  metadata: Record<string, unknown> | undefined;
  state: Record<string, unknown> | undefined;
  isExpanded: boolean;
  isMobile: boolean;
  isActive: boolean;
}

export type ToolRendererComponent = React.ComponentType<ToolRendererProps>;

export interface ToolRendererContribution {
  type: "toolRenderer";
  toolName: string;
  matchType: ToolRendererMatchType;
  render: ToolRendererComponent;
  pluginId: string;
  source: PluginSource;
  priority: number;
  featureId?: string;
  isCore: boolean;
}

export interface ToolRendererConfig {
  render: ToolRendererComponent;
  matchType?: ToolRendererMatchType;
  priority?: number;
  featureId?: string;
  isCore?: boolean;
}

export interface ToolRendererContributionRecord {
  toolName: string;
  matchType: ToolRendererMatchType;
  pluginId: string;
  source: PluginSource;
  priority: number;
  data: ToolRendererContribution;
}

export interface ToolIconConfig {
  icon: React.ComponentType<{ className?: string }>;
  matchType?: ToolRendererMatchType;
  priority?: number;
  featureId?: string;
  isCore?: boolean;
}

export interface ToolIconContribution {
  type: "toolIcon";
  toolName: string;
  matchType: ToolRendererMatchType;
  icon: React.ComponentType<{ className?: string }>;
  pluginId: string;
  source: PluginSource;
  priority: number;
  featureId?: string;
  isCore: boolean;
}

export interface ToolIconContributionRecord {
  toolName: string;
  matchType: ToolRendererMatchType;
  pluginId: string;
  source: PluginSource;
  priority: number;
  data: ToolIconContribution;
}

export interface ToolMetadataConfig {
  displayName: string;
  description?: string;
  priority?: number;
  featureId?: string;
  isCore?: boolean;
}

export interface ToolMetadataContribution {
  type: "toolMetadata";
  toolName: string;
  matchType: ToolRendererMatchType;
  displayName: string;
  description?: string;
  pluginId: string;
  source: PluginSource;
  priority: number;
  featureId?: string;
  isCore: boolean;
}

export interface ToolMetadataContributionRecord {
  toolName: string;
  matchType: ToolRendererMatchType;
  pluginId: string;
  source: PluginSource;
  priority: number;
  data: ToolMetadataContribution;
}

export type ToolPresentationClass = "expandable" | "static" | "standalone";

export interface ToolClassifierConfig {
  classify: (toolName: string, input: Record<string, unknown> | undefined, output: string | undefined, metadata: Record<string, unknown> | undefined) => ToolPresentationClass;
  priority?: number;
  featureId?: string;
  isCore?: boolean;
}

export interface ToolClassifierContribution {
  type: "toolClassifier";
  toolName: string;
  matchType: ToolRendererMatchType;
  classify: (toolName: string, input: Record<string, unknown> | undefined, output: string | undefined, metadata: Record<string, unknown> | undefined) => ToolPresentationClass;
  pluginId: string;
  source: PluginSource;
  priority: number;
  featureId?: string;
  isCore: boolean;
}

export interface ToolClassifierContributionRecord {
  toolName: string;
  matchType: ToolRendererMatchType;
  pluginId: string;
  source: PluginSource;
  priority: number;
  data: ToolClassifierContribution;
}

export interface ToolLanguageDetectorConfig {
  detectLanguage: (toolName: string, output: string, input: Record<string, unknown> | undefined) => string;
  priority?: number;
  featureId?: string;
  isCore?: boolean;
}

export interface ToolLanguageDetectorContribution {
  type: "toolLanguageDetector";
  toolName: string;
  matchType: ToolRendererMatchType;
  detectLanguage: (toolName: string, output: string, input: Record<string, unknown> | undefined) => string;
  pluginId: string;
  source: PluginSource;
  priority: number;
  featureId?: string;
  isCore: boolean;
}

export interface ToolLanguageDetectorContributionRecord {
  toolName: string;
  matchType: ToolRendererMatchType;
  pluginId: string;
  source: PluginSource;
  priority: number;
  data: ToolLanguageDetectorContribution;
}

export interface ToolSideEffectHintConfig {
  hint: string;
  priority?: number;
  featureId?: string;
  isCore?: boolean;
}

export interface ToolSideEffectHintContribution {
  type: "toolSideEffectHint";
  toolName: string;
  matchType: ToolRendererMatchType;
  hint: string;
  pluginId: string;
  source: PluginSource;
  priority: number;
  featureId?: string;
  isCore: boolean;
}

export interface ToolSideEffectHintContributionRecord {
  toolName: string;
  matchType: ToolRendererMatchType;
  pluginId: string;
  source: PluginSource;
  priority: number;
  data: ToolSideEffectHintContribution;
}
