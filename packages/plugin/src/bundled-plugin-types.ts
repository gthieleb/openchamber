import type { PluginTarget } from "./types";

export interface BundledPluginManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  source: "bundled";
  targets: PluginTarget[];
  capabilities: string[];
  optionalCapabilities: string[];
  priority: number;
  required: boolean;
  enabledByDefault: boolean;
  entry: string;
  serverEntry?: string;
}

export interface BundledPluginUIEntry {
  manifest: BundledPluginManifest;
  setup: (ctx: unknown) => void | Promise<void>;
}

export interface BundledPluginServerEntry {
  manifest: BundledPluginManifest;
  setup: (ctx: unknown) => void | Promise<void>;
}

export interface BundledPluginPackage {
  manifest: BundledPluginManifest;
  uiEntry?: () => Promise<{ default: (ctx: unknown) => void | Promise<void> }>;
  serverEntry?: () => Promise<{ default: (ctx: unknown) => void | Promise<void> }>;
}

export interface BundledPluginConfig {
  plugins: BundledPluginPackage[];
}

export interface BundledPluginDefinition {
  id: string;
  name: string;
  version: string;
  description?: string;
  targets?: PluginTarget[];
  capabilities?: string[];
  optionalCapabilities?: string[];
  priority?: number;
  required?: boolean;
  enabledByDefault?: boolean;
  entry: string;
  serverEntry?: string;
}

export function createBundledPluginManifest(
  def: BundledPluginDefinition,
): BundledPluginManifest {
  return {
    id: def.id,
    name: def.name,
    version: def.version,
    description: def.description,
    source: "bundled",
    targets: def.targets ?? ["ui", "server"],
    capabilities: def.capabilities ?? [],
    optionalCapabilities: def.optionalCapabilities ?? [],
    priority: def.priority ?? 0,
    required: def.required ?? false,
    enabledByDefault: def.enabledByDefault ?? true,
    entry: def.entry,
    serverEntry: def.serverEntry,
  };
}
