export type PluginSource = "builtin" | "bundled" | "user";

export type PluginTarget =
  | "ui"
  | "server"
  | "vscode-extension-host"
  | "electron-main";

export type PluginCapability =
  | "ui.fill"
  | "ui.surface"
  | "ui.replace"
  | "ui.wrap"
  | "ui.slot"
  | "ui.renderer"
  | "ui.command"
  | "settings.page"
  | "settings.section"
  | "settings.schema"
  | "storage.global"
  | "storage.workspace"
  | "fs.read"
  | "fs.write"
  | "fs.exec"
  | "filesystem"
  | "git.read"
  | "git.write"
  | "terminal"
  | "notifications"
  | "auth.provider"
  | "server.route"
  | "server.middleware"
  | "server.lifecycle"
  | "server.event"
  | "model.policy"
  | "desktop.window"
  | "vscode.command";

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  source: PluginSource;
  targets: PluginTarget[];
  capabilities: PluginCapability[];
  optionalCapabilities: PluginCapability[];
  priority: number;
  required: boolean;
}

export interface PluginContext {
  manifest: RuntimePluginEntry;
  capabilities: GrantedCapabilities;
  ui: PluginUIAPI;
  commands: PluginCommandsAPI;
  settings: PluginSettingsAPI;
  storage: PluginStorageAPI;
  tools: PluginToolsAPI;
  models: PluginModelsAPI;
  runtime: PluginRuntimeAPI;
  server?: PluginServerAPI;
}

export interface GrantedCapabilities {
  granted: PluginCapability[];
  denied: PluginCapability[];
  has(capability: PluginCapability): boolean;
}

export interface PluginUIAPI {
  fill(slotId: string, component: unknown, options?: { priority?: number }): void;
  surface(surfaceId: string, config: UISurfaceConfig): void;
  replace(targetId: string, component: unknown, options?: { priority?: number }): void;
  wrap(targetId: string, wrapper: unknown, options?: { priority?: number }): void;
  slot(slotId: string, config: UISlotConfig): void;
}

export interface UISlotConfig {
  render: unknown;
  featureId?: string;
}

export interface UISurfaceConfig {
  title: string;
  placements: string[];
  render: unknown;
  featureId?: string;
}

export interface PluginCommandsAPI {
  register(commandId: string, config: { title: string; run: (...args: unknown[]) => unknown }): void;
}

export interface PluginSettingsAPI {
  page(pageId: string, config: { title: string; render: unknown }): void;
  section(pageId: string, sectionId: string, config: { title: string; render: unknown }): void;
}

export interface PluginStorageAPI {
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T): void;
  delete(key: string): void;
}

export interface PluginToolsAPI {
  registerRenderer(toolName: string, renderer: unknown): void;
}

export interface PluginModelsAPI {
  filter(fn: (models: unknown[]) => unknown[]): void;
  decorate(fn: (models: unknown[]) => unknown[]): void;
}

export interface PluginRuntimeAPI {
  target: PluginTarget;
  isRuntime(target: PluginTarget): boolean;
}

export interface PluginServerAPI {
  routes(routeId: string, register: (router: unknown) => void, options?: { phase?: string }): void;
  middleware(middlewareId: string, middleware: unknown, options?: { phase?: string }): void;
  lifecycle(hook: ServerLifecycleHook, fn: () => void | Promise<void>): void;
}

export type ServerLifecycleHook =
  | "beforeRoutes"
  | "afterRoutes"
  | "beforeListen"
  | "afterListen"
  | "beforeShutdown"
  | "afterShutdown";

export interface PluginDefinition {
  id: string;
  name: string;
  version: string;
  description?: string;
  source?: PluginSource;
  targets?: PluginTarget[];
  capabilities?: PluginCapability[];
  optionalCapabilities?: PluginCapability[];
  priority?: number;
  required?: boolean;
  enabledByDefault?: boolean;
  setup(ctx: PluginContext): void | Promise<void>;
}

export interface DefinedPlugin {
  (ctx: PluginContext): void | Promise<void>;
  __definition: PluginDefinition;
}

export function definePlugin(def: PluginDefinition): DefinedPlugin {
  const setup = (ctx: PluginContext) => def.setup(ctx);
  (setup as DefinedPlugin).__definition = def;
  return setup as DefinedPlugin;
}

export type PluginStatus = "pending" | "ready" | "error" | "disabled" | "skipped";

export interface PluginRegistryEntry {
  definition: PluginDefinition;
  setupFn: (ctx: PluginContext) => void | Promise<void>;
  manifest: PluginManifest;
  contributions: Map<string, unknown[]>;
  grantedCapabilities: PluginCapability[];
  deniedCapabilities: PluginCapability[];
  setupErrors: string[];
  status: PluginStatus;
  disposables: Array<() => void>;
}

export interface RuntimePluginEntry {
  id: string;
  name: string;
  version: string;
  description?: string;
  source: PluginSource;
  targets: PluginTarget[];
  capabilities: PluginCapability[];
  optionalCapabilities: PluginCapability[];
  priority: number;
  required: boolean;
}

export interface ContributionRecord {
  type: string;
  id: string;
  pluginId: string;
  source: PluginSource;
  priority: number;
  data: unknown;
}

export interface PluginDiagnostics {
  id: string;
  name: string;
  version: string;
  source: PluginSource;
  targets: PluginTarget[];
  status: PluginStatus;
  grantedCapabilities: PluginCapability[];
  deniedCapabilities: PluginCapability[];
  contributionCount: number;
  contributionsByType: Record<string, number>;
  setupErrors: string[];
}
