import { PluginRegistry } from "./registry";
import { FeatureRegistry } from "./feature-registry";
import type { BundledPluginPackage, BundledPluginUIEntry } from "./bundled-plugin-types";

export async function loadBundledUIPlugins(
  registry: PluginRegistry,
  featureRegistry: FeatureRegistry,
  packages: BundledPluginPackage[],
): Promise<BundledPluginUIEntry[]> {
  const loaded: BundledPluginUIEntry[] = [];

  for (const pkg of packages) {
    if (!pkg.uiEntry) continue;
    if (!pkg.manifest.targets.includes("ui")) continue;

    try {
      const module = await pkg.uiEntry();
      const setupFn = module.default;

      const entry: BundledPluginUIEntry = {
        manifest: pkg.manifest,
        setup: setupFn,
      };

      loaded.push(entry);
    } catch (error) {
      console.error(`[BundledPlugins] Failed to load UI plugin "${pkg.manifest.id}":`, error);
    }
  }

  return loaded;
}

export function getBundledUIDiagnostics(packages: BundledPluginPackage[]) {
  return packages
    .filter((p) => p.manifest.targets.includes("ui"))
    .map((p) => ({
      id: p.manifest.id,
      name: p.manifest.name,
      version: p.manifest.version,
      source: "bundled" as const,
      target: "ui" as const,
      enabled: p.manifest.enabledByDefault !== false,
      hasEntry: !!p.uiEntry,
    }));
}
