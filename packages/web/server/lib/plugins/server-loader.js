import path from "path";
import fs from "fs";

const ALLOWED_SERVER_CAPABILITIES = new Set([
  "server.route",
  "server.middleware",
  "server.lifecycle",
  "server.event",
  "storage.global",
  "storage.workspace",
  "fs.read",
  "fs.write",
  "fs.exec",
  "filesystem",
  "git.read",
  "git.write",
  "notifications",
  "model.policy",
]);

const DANGEROUS_CAPABILITIES = new Set([
  "fs.write",
  "fs.exec",
  "git.write",
]);

function normalizePath(input) {
  return path.resolve(input);
}

function isPathUnderAllowlist(pluginPath, allowlist) {
  if (allowlist.length === 0) return true;
  const resolved = normalizePath(pluginPath);
  for (const allowed of allowlist) {
    const normalizedAllowed = normalizePath(allowed);
    if (resolved === normalizedAllowed || resolved.startsWith(normalizedAllowed + path.sep)) {
      return true;
    }
  }
  return false;
}

function validateCapabilities(capabilities) {
  const invalid = [];
  for (const cap of capabilities) {
    if (!ALLOWED_SERVER_CAPABILITIES.has(cap)) {
      invalid.push(cap);
    }
  }
  return invalid;
}

function validatePluginPath(pluginPath) {
  const resolved = path.resolve(pluginPath);
  const resolvedDir = path.dirname(resolved);

  if (!fs.existsSync(resolvedDir)) {
    return { valid: false, error: `Plugin directory does not exist: ${resolvedDir}` };
  }

  if (!fs.existsSync(resolved)) {
    return { valid: false, error: `Plugin entry file does not exist: ${resolved}` };
  }

  const stat = fs.statSync(resolved);
  if (!stat.isFile()) {
    return { valid: false, error: `Plugin entry must be a file: ${resolved}` };
  }

  return { valid: true, resolvedPath: resolved };
}

async function loadServerPlugin(pluginPath) {
  const validation = validatePluginPath(pluginPath);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  try {
    const importPath = `file://${validation.resolvedPath}`;
    const mod = await import(importPath);
    const entry = mod.default || mod.plugin || mod.createPlugin;
    if (!entry) {
      throw new Error(
        `Plugin module must export a default export, "plugin", or "createPlugin": ${validation.resolvedPath}`,
      );
    }
    return { entry, resolvedPath: validation.resolvedPath };
  } catch (error) {
    if (error.message.startsWith("Plugin ") || error.message.startsWith("Failed to ")) {
      throw error;
    }
    throw new Error(`Failed to load server plugin: ${error.message}`);
  }
}

function createServerPluginLoader(options = {}) {
  const { allowlist = [], serverRegistry } = options;
  const loadedPlugins = new Map();
  const setupErrors = new Map();

  async function loadAndRegister(pluginPath, pluginId) {
    const validation = validatePluginPath(pluginPath);
    if (!validation.valid) {
      const error = { pluginId, path: pluginPath, error: validation.error, phase: "validation" };
      setupErrors.set(pluginId, error);
      throw new Error(validation.error);
    }

    if (!isPathUnderAllowlist(pluginPath, allowlist)) {
      const error = {
        pluginId,
        path: pluginPath,
        error: `Plugin path is not in the allowlist. Allowlisted paths: ${allowlist.join(", ")}`,
        phase: "allowlist",
      };
      setupErrors.set(pluginId, error);
      throw new Error(error.error);
    }

    let loaded;
    try {
      loaded = await loadServerPlugin(pluginPath);
    } catch (error) {
      const loadError = { pluginId, path: pluginPath, error: error.message, phase: "load" };
      setupErrors.set(pluginId, loadError);
      throw error;
    }

    const pluginFn = loaded.entry;
    const definition = pluginFn.__definition;
    if (!definition) {
      const error = {
        pluginId,
        path: pluginPath,
        error: "Plugin must be created with definePlugin()",
        phase: "validation",
      };
      setupErrors.set(pluginId, error);
      throw new Error(error.error);
    }

    const invalidCaps = validateCapabilities(definition.capabilities || []);
    if (invalidCaps.length > 0) {
      const error = {
        pluginId,
        path: pluginPath,
        error: `Server plugins cannot request these capabilities: ${invalidCaps.join(", ")}`,
        phase: "capability",
      };
      setupErrors.set(pluginId, error);
      throw new Error(error.error);
    }

    const disposables = [];
    let setupOk = false;
    try {
      const ctx = buildPluginContext(definition, serverRegistry, disposables);
      await pluginFn(ctx);
      setupOk = true;
    } catch (error) {
      const setupError = {
        pluginId,
        path: pluginPath,
        error: error.message,
        phase: "setup",
        stack: error.stack,
      };
      setupErrors.set(pluginId, setupError);
      for (const dispose of disposables) {
        try {
          dispose();
        } catch {
        }
      }
      throw error;
    }

    loadedPlugins.set(pluginId, {
      definition,
      path: pluginPath,
      resolvedPath: loaded.resolvedPath,
      disposables,
      status: setupOk ? "ready" : "error",
    });

    return { pluginId, status: "ready" };
  }

  function getLoadedPlugins() {
    return Array.from(loadedPlugins.entries()).map(([id, info]) => ({
      id,
      name: info.definition.name,
      version: info.definition.version,
      path: info.path,
      resolvedPath: info.resolvedPath,
      status: info.status,
      capabilities: info.definition.capabilities || [],
      hasDangerousCapabilities: (info.definition.capabilities || []).some((c) =>
        DANGEROUS_CAPABILITIES.has(c),
      ),
    }));
  }

  function getSetupErrors() {
    return Array.from(setupErrors.entries()).map(([id, error]) => ({
      pluginId: id,
      ...error,
    }));
  }

  function getPluginById(pluginId) {
    return loadedPlugins.get(pluginId) || null;
  }

  async function disposeAll() {
    for (const [, info] of loadedPlugins.entries()) {
      for (const dispose of info.disposables) {
        try {
          dispose();
        } catch (error) {
          console.error(`[ServerPluginLoader] Dispose failed:`, error.message);
        }
      }
    }
    loadedPlugins.clear();
    setupErrors.clear();
  }

  return {
    loadAndRegister,
    getLoadedPlugins,
    getSetupErrors,
    getPluginById,
    disposeAll,
  };
}

function buildPluginContext(definition, serverRegistry, disposables) {
  return {
    manifest: {
      id: definition.id,
      name: definition.name,
      version: definition.version,
      description: definition.description,
      source: "user",
      targets: definition.targets || ["server"],
      capabilities: definition.capabilities || [],
      optionalCapabilities: definition.optionalCapabilities || [],
      priority: definition.priority ?? 0,
      required: definition.required ?? false,
    },
    capabilities: {
      granted: definition.capabilities || [],
      denied: [],
      has(capability) {
        return (definition.capabilities || []).includes(capability);
      },
    },
    server: {
      routes(routeId, register, options = {}) {
        if (!serverRegistry) {
          throw new Error("Server registry not available");
        }
        serverRegistry.registerRoutes(routeId, register, definition.id, "user", {
          phase: options.phase,
          priority: options.priority,
        });
      },
      middleware(middlewareId, middleware, options = {}) {
        if (!serverRegistry) {
          throw new Error("Server registry not available");
        }
        serverRegistry.registerMiddleware(middlewareId, middleware, definition.id, "user", {
          phase: options.phase,
          priority: options.priority,
        });
      },
      lifecycle(hook, fn) {
        if (!serverRegistry) {
          throw new Error("Server registry not available");
        }
        serverRegistry.registerLifecycle(hook, fn, definition.id);
      },
    },
  };
}

export {
  createServerPluginLoader,
  validatePluginPath,
  validateCapabilities,
  isPathUnderAllowlist,
  ALLOWED_SERVER_CAPABILITIES,
  DANGEROUS_CAPABILITIES,
};
