const { createServerPluginRegistry } = require("./registry.js");
const { createFeatureRegistry } = require("../features/registry.js");

async function loadBundledServerPlugins(
  serverRegistry,
  featureRegistry,
  packages,
) {
  const loaded = [];

  for (const pkg of packages) {
    if (!pkg.serverEntry) continue;
    if (!pkg.manifest.targets.includes("server")) continue;

    try {
      const module = await pkg.serverEntry();
      const setupFn = module.default;

      const entry = {
        manifest: pkg.manifest,
        setup: setupFn,
      };

      loaded.push(entry);
    } catch (error) {
      console.error(`[BundledPlugins] Failed to load server plugin "${pkg.manifest.id}":`, error);
    }
  }

  return loaded;
}

function getBundledServerDiagnostics(packages) {
  return packages
    .filter((p) => p.manifest.targets.includes("server"))
    .map((p) => ({
      id: p.manifest.id,
      name: p.manifest.name,
      version: p.manifest.version,
      source: "bundled",
      target: "server",
      enabled: p.manifest.enabledByDefault !== false,
      hasEntry: !!p.serverEntry,
    }));
}

module.exports = {
  loadBundledServerPlugins,
  getBundledServerDiagnostics,
};
