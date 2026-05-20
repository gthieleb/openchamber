import { BUILTIN_SERVER_PLUGINS } from "./builtin-loader.js";

export function createPluginDiagnostics(options = {}) {
  const { featureRegistry, serverRegistry, bundledPackages = [], serverLoader } = options;

  function getPluginDiagnostics() {
    const builtinPlugins = BUILTIN_SERVER_PLUGINS.map((def) => {
      const isEnabled = def.enabledByDefault !== false;
      const contributions = serverRegistry
        ? serverRegistry.getAllContributions().filter((c) => c.pluginId === def.id)
        : [];

      return {
        id: def.id,
        name: def.name,
        version: def.version,
        description: def.description || null,
        source: def.source,
        targets: def.targets,
        capabilities: def.capabilities,
        optionalCapabilities: def.optionalCapabilities,
        enabled: isEnabled,
        enabledByDefault: def.enabledByDefault,
        required: def.required,
        contributionCount: contributions.length,
        contributions: contributions.map((c) => ({
          type: c.type,
          id: c.id,
          phase: c.phase || null,
          priority: c.priority,
        })),
        setupErrors: [],
        status: isEnabled ? "ready" : "disabled",
      };
    });

    const bundledPlugins = bundledPackages
      .filter((pkg) => pkg.manifest.targets.includes("server"))
      .map((pkg) => {
        const def = pkg.manifest;
        const isEnabled = def.enabledByDefault !== false;
        const contributions = serverRegistry
          ? serverRegistry.getAllContributions().filter((c) => c.pluginId === def.id)
          : [];

        return {
          id: def.id,
          name: def.name,
          version: def.version,
          description: def.description || null,
          source: def.source,
          targets: def.targets,
          capabilities: def.capabilities,
          optionalCapabilities: def.optionalCapabilities,
          enabled: isEnabled,
          enabledByDefault: def.enabledByDefault,
          required: def.required,
          contributionCount: contributions.length,
          contributions: contributions.map((c) => ({
            type: c.type,
            id: c.id,
            phase: c.phase || null,
            priority: c.priority,
          })),
          setupErrors: [],
          status: isEnabled ? "ready" : "disabled",
          hasServerEntry: !!pkg.serverEntry,
        };
      });

    const allPlugins = [...builtinPlugins, ...bundledPlugins];

    const serverLoadedPlugins = serverLoader
      ? serverLoader.getLoadedPlugins().map((info) => ({
          id: info.id,
          name: info.name,
          version: "1.0.0",
          description: null,
          source: "user",
          targets: ["server"],
          capabilities: info.capabilities,
          optionalCapabilities: [],
          enabled: true,
          enabledByDefault: false,
          required: false,
          contributionCount: 0,
          contributions: [],
          setupErrors: [],
          status: info.status,
          hasDangerousCapabilities: info.hasDangerousCapabilities,
          path: info.path,
        }))
      : [];

    const serverLoadErrors = serverLoader
      ? serverLoader.getSetupErrors().map((err) => ({
          id: `error:${err.pluginId}`,
          name: err.pluginId,
          version: "unknown",
          description: null,
          source: "user",
          targets: ["server"],
          capabilities: [],
          optionalCapabilities: [],
          enabled: false,
          enabledByDefault: false,
          required: false,
          contributionCount: 0,
          contributions: [],
          setupErrors: [{ phase: err.phase, error: err.error }],
          status: "error",
          path: err.path,
        }))
      : [];

    const allPluginsWithLoaded = [...allPlugins, ...serverLoadedPlugins, ...serverLoadErrors];

    return {
      loadedAt: new Date().toISOString(),
      pluginCount: allPluginsWithLoaded.length,
      builtinCount: builtinPlugins.length,
      bundledCount: bundledPackages.length,
      userLoadedCount: serverLoadedPlugins.length,
      userErrorCount: serverLoadErrors.length,
      contributionCount: serverRegistry ? serverRegistry.getContributionCount() : 0,
      plugins: allPluginsWithLoaded,
    };
  }

  function getPluginDiagnosticsById(pluginId) {
    const builtinDef = BUILTIN_SERVER_PLUGINS.find((p) => p.id === pluginId);
    if (builtinDef) {
      const contributions = serverRegistry
        ? serverRegistry.getAllContributions().filter((c) => c.pluginId === builtinDef.id)
        : [];

      return {
        id: builtinDef.id,
        name: builtinDef.name,
        version: builtinDef.version,
        description: builtinDef.description || null,
        source: builtinDef.source,
        targets: builtinDef.targets,
        capabilities: builtinDef.capabilities,
        optionalCapabilities: builtinDef.optionalCapabilities,
        enabled: builtinDef.enabledByDefault !== false,
        enabledByDefault: builtinDef.enabledByDefault,
        required: builtinDef.required,
        contributionCount: contributions.length,
        contributions: contributions.map((c) => ({
          type: c.type,
          id: c.id,
          phase: c.phase || null,
          priority: c.priority,
        })),
        setupErrors: [],
        status: builtinDef.enabledByDefault !== false ? "ready" : "disabled",
      };
    }

    const bundledPkg = bundledPackages.find((p) => p.manifest.id === pluginId);
    if (bundledPkg) {
      const def = bundledPkg.manifest;
      const contributions = serverRegistry
        ? serverRegistry.getAllContributions().filter((c) => c.pluginId === def.id)
        : [];

      return {
        id: def.id,
        name: def.name,
        version: def.version,
        description: def.description || null,
        source: def.source,
        targets: def.targets,
        capabilities: def.capabilities,
        optionalCapabilities: def.optionalCapabilities,
        enabled: def.enabledByDefault !== false,
        enabledByDefault: def.enabledByDefault,
        required: def.required,
        contributionCount: contributions.length,
        contributions: contributions.map((c) => ({
          type: c.type,
          id: c.id,
          phase: c.phase || null,
          priority: c.priority,
        })),
        setupErrors: [],
        status: def.enabledByDefault !== false ? "ready" : "disabled",
        hasServerEntry: !!bundledPkg.serverEntry,
      };
    }

    if (serverLoader) {
      const loadedInfo = serverLoader.getPluginById(pluginId);
      if (loadedInfo) {
        return {
          id: loadedInfo.definition.id,
          name: loadedInfo.definition.name,
          version: loadedInfo.definition.version,
          description: loadedInfo.definition.description || null,
          source: "user",
          targets: loadedInfo.definition.targets || ["server"],
          capabilities: loadedInfo.definition.capabilities || [],
          optionalCapabilities: loadedInfo.definition.optionalCapabilities || [],
          enabled: true,
          enabledByDefault: false,
          required: false,
          contributionCount: 0,
          contributions: [],
          setupErrors: [],
          status: loadedInfo.status,
          path: loadedInfo.path,
        };
      }

      const loadError = serverLoader.getSetupErrors().find((e) => e.pluginId === pluginId);
      if (loadError) {
        return {
          id: loadError.pluginId,
          name: loadError.pluginId,
          version: "unknown",
          description: null,
          source: "user",
          targets: ["server"],
          capabilities: [],
          optionalCapabilities: [],
          enabled: false,
          enabledByDefault: false,
          required: false,
          contributionCount: 0,
          contributions: [],
          setupErrors: [{ phase: loadError.phase, error: loadError.error }],
          status: "error",
          path: loadError.path,
        };
      }
    }

    return null;
  }

  return {
    getPluginDiagnostics,
    getPluginDiagnosticsById,
  };
}
