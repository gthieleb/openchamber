export {
  definePlugin,
  type ContributionRecord,
  type DefinedPlugin,
  type GrantedCapabilities,
  type PluginCapability,
  type PluginContext,
  type PluginDefinition,
  type PluginDiagnostics,
  type PluginManifest,
  type PluginRegistryEntry,
  type PluginRuntimeAPI,
  type PluginServerAPI,
  type PluginSettingsAPI,
  type PluginSource,
  type PluginStatus,
  type PluginTarget,
  type PluginUIAPI,
  type RuntimePluginEntry,
  type ServerLifecycleHook,
  type UISurfaceConfig,
} from "./types";

export { PluginRegistry } from "./registry";

export {
  FeatureRegistry,
} from "./feature-registry";

export type {
  FeatureDefinition,
  FeatureEntry,
  FeatureId,
  FeatureSnapshot,
} from "./features";

export {
  UIContributionRegistry,
} from "./ui-registry";

export type {
  UIFillContribution,
  UISurfaceContribution,
  UIReplaceContribution,
  UIWrapContribution,
  UIContribution,
  UIContributionOptions,
  UISurfaceConfig as UISurfaceConfigType,
  UIReplacementConfig,
  UIWrapConfig,
  UIContributionRecord as UIContributionRecordType,
} from "./ui-types";

export {
  UIContextProvider,
  useUIContext,
  Slot,
  SurfaceOutlet,
  ReplaceableSurface,
  WrapTarget,
  PluginErrorBoundary,
} from "./ui-components";

export type {
  UIContextValue,
  SlotProps,
  SurfaceOutletProps,
  ReplaceableSurfaceProps,
  WrapTargetProps,
  PluginErrorBoundaryProps,
} from "./ui-components";

export {
  loadBuiltinPlugins,
  getBuiltinDiagnostics,
} from "./builtin-loader";

export type {
  BuiltinPluginEntry,
  BuiltinLoaderConfig,
  BuiltinPluginResult,
  BuiltinLoaderResult,
} from "./builtin-loader";

export {
  TERMINAL_PLUGIN_ID,
  TERMINAL_FEATURE_ID,
  registerServerPlugin as registerTerminalServerPlugin,
  registerUIPlugin as registerTerminalUIPlugin,
} from "@openchamber/plugin-terminal";

export {
  FILES_PLUGIN_ID,
  FILES_FEATURE_ID,
  registerServerPlugin as registerFilesServerPlugin,
  registerUIPlugin as registerFilesUIPlugin,
} from "@openchamber/plugin-files";

export {
  GIT_PLUGIN_ID,
  GIT_FEATURE_ID,
  registerServerPlugin as registerGitServerPlugin,
  registerUIPlugin as registerGitUIPlugin,
} from "@openchamber/plugin-git";

export {
  GITHUB_PLUGIN_ID,
  GITHUB_FEATURE_ID,
  registerServerPlugin as registerGitHubServerPlugin,
  registerUIPlugin as registerGitHubUIPlugin,
} from "@openchamber/plugin-github";

export {
  CHAT_PLUGIN_ID,
  CHAT_FEATURE_ID,
  registerServerPlugin as registerChatServerPlugin,
  registerUIPlugin as registerChatUIPlugin,
} from "@openchamber/plugin-chat";

export { MainTabRegistry } from "./main-tab-registry";

export type {
  MainTabContribution,
  MainTabConfig,
  MainTabContributionRecord,
  MainTabContributionType,
} from "./main-tab-types";

export { RightPanelRegistry } from "./right-panel-registry";

export type {
  RightPanelContribution,
  RightPanelConfig,
  RightPanelContributionRecord,
  RightPanelContributionType,
} from "./right-panel-types";

export { ContextPanelRendererRegistry } from "./context-panel-registry";

export type {
  ContextPanelRendererContribution,
  ContextPanelRendererConfig,
  ContextPanelRendererRecord,
  ContextPanelRendererType,
} from "./context-panel-types";

export { SettingsPageRegistry } from "./settings-registry";

export type {
  SettingsPageContribution,
  SettingsPageConfig,
  SettingsPageContributionRecord,
  SettingsPageKind,
  SettingsPageGroup,
  SettingsRuntimeContext,
} from "./settings-types";

export { SettingsSectionRegistry } from "./settings-section-registry";

export type {
  SettingsSectionConfig,
  SettingsSectionContribution,
  SettingsSectionContributionRecord,
} from "./settings-section-types";

export { CommandRegistry } from "./command-registry";

export type {
  CommandContribution,
  CommandConfig,
  CommandContributionRecord,
  CommandGroup,
} from "./command-types";

export { ToolRendererRegistry } from "./tool-renderer-registry";

export type {
  ToolRendererProps,
  ToolRendererComponent,
  ToolPresentationClass,
  ToolClassifierConfig,
  ToolClassifierContribution,
  ToolClassifierContributionRecord,
  ToolLanguageDetectorConfig,
  ToolLanguageDetectorContribution,
  ToolLanguageDetectorContributionRecord,
  ToolSideEffectHintConfig,
  ToolSideEffectHintContribution,
  ToolSideEffectHintContributionRecord,
} from "./tool-renderer-types";

export { PluginStorageRegistry, getQuotaForScope } from "./plugin-storage-registry";

export type {
  PluginStorageScope,
  PluginStorageQuota,
  PluginStorageConfig,
  PluginStorageContribution,
  PluginStorageContributionRecord,
  PluginSettingsSchemaConfig,
  PluginSettingsSchemaContribution,
  PluginSettingsSchemaContributionRecord,
} from "./plugin-storage-types";

export { loadBundledUIPlugins, getBundledUIDiagnostics } from "./bundled-plugin-loader";

export type {
  BundledPluginManifest,
  BundledPluginUIEntry,
  BundledPluginServerEntry,
  BundledPluginPackage,
  BundledPluginConfig,
} from "./bundled-plugin-types";

export { createBundledPluginManifest } from "./bundled-plugin-types";

export {
  RUNTIME_CAPABILITY_DESCRIPTORS,
  hasCapability,
  type RuntimeCapability,
  type RuntimeCapabilityDescriptor,
  type PluginRuntimeAPIs,
  type PluginRuntimeAPIConfig,
} from "./runtime-capabilities";

export {
  createPluginRuntimeFacade,
} from "./runtime-facade";

export { AuthProviderRegistry } from "./auth-provider-registry";

export type {
  AuthProviderLoginProps,
  AuthProviderDescriptor,
  AuthProviderSnapshot,
} from "./auth-provider-types";

export {
  createFakeAuthProviderConfig,
  isDevAuthProvider,
  DEV_AUTH_PROVIDER_ID,
  type FakeAuthProviderConfig,
} from "./fake-auth-provider";

export { BottomDockRegistry } from "./bottom-dock-registry";

export type {
  BottomDockSurfaceConfig,
  BottomDockSurfaceContribution,
  BottomDockSurfaceContributionRecord,
} from "./bottom-dock-types";
