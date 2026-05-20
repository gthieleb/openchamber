import { createFeatureRegistry } from "../features/registry.js";
import { createServerPluginRegistry } from "./registry.js";
import { TERMINAL_PLUGIN_ID, TERMINAL_FEATURE_ID, registerServerPlugin as registerTerminalServer } from "@openchamber/plugin-terminal";
import { FILES_PLUGIN_ID, FILES_FEATURE_ID, registerServerPlugin as registerFilesServer } from "@openchamber/plugin-files";
import { GIT_PLUGIN_ID, GIT_FEATURE_ID, registerServerPlugin as registerGitServer } from "@openchamber/plugin-git";
import { GITHUB_PLUGIN_ID, GITHUB_FEATURE_ID, registerServerPlugin as registerGitHubServer } from "@openchamber/plugin-github";
import { CHAT_PLUGIN_ID, CHAT_FEATURE_ID, registerServerPlugin as registerChatServer } from "@openchamber/plugin-chat";
import { HELLO_WORLD_PLUGIN_ID, HELLO_WORLD_FEATURE_ID, registerServerPlugin as registerHelloWorldServer } from "@openchamber/plugin-hello-world";

function createPluginDefinition(id, name, description, featureId, capabilities, registerFn) {
  return {
    id,
    name,
    version: "1.11.1",
    description,
    source: "builtin",
    targets: ["server"],
    capabilities,
    optionalCapabilities: [],
    priority: 0,
    required: false,
    enabledByDefault: true,
    featureId,
    setup: (ctx) => registerFn(ctx),
  };
}

export const BUILTIN_SERVER_PLUGINS = [
  createPluginDefinition(
    TERMINAL_PLUGIN_ID,
    "Terminal",
    "Terminal and PTY support",
    TERMINAL_FEATURE_ID,
    ["server.route", "terminal"],
    registerTerminalServer,
  ),
  createPluginDefinition(
    FILES_PLUGIN_ID,
    "Files",
    "File explorer and editor support",
    FILES_FEATURE_ID,
    ["server.route", "filesystem"],
    registerFilesServer,
  ),
  createPluginDefinition(
    GIT_PLUGIN_ID,
    "Git",
    "Git integration",
    GIT_FEATURE_ID,
    ["server.route", "git"],
    registerGitServer,
  ),
  createPluginDefinition(
    GITHUB_PLUGIN_ID,
    "GitHub",
    "GitHub authentication and repository integration",
    GITHUB_FEATURE_ID,
    ["server.route", "github"],
    registerGitHubServer,
  ),
  createPluginDefinition(
    CHAT_PLUGIN_ID,
    "Chat",
    "Core chat interface",
    CHAT_FEATURE_ID,
    ["server.route", "chat"],
    registerChatServer,
  ),
  createPluginDefinition(
    HELLO_WORLD_PLUGIN_ID,
    "Hello World",
    "Demo plugin to test the plugin architecture",
    HELLO_WORLD_FEATURE_ID,
    ["server.route", "ui.surface", "ui.settings"],
    registerHelloWorldServer,
  ),
  {
    id: "openchamber.plugin.example",
    name: "Example Server Plugin",
    version: "1.11.1",
    description: "No-op built-in server plugin to prove the loader path",
    source: "builtin",
    targets: ["server"],
    capabilities: [],
    optionalCapabilities: [],
    priority: 0,
    required: false,
    enabledByDefault: true,
    setup: (ctx) => {
      ctx.server?.routes("openchamber.plugin.example.health", (router) => {
        router.get("/api/plugins/example/health", (_req, res) => {
          res.json({ status: "ok", plugin: "openchamber.plugin.example" });
        });
      });
    },
  },
];

export function createBuiltinServerLoader(options = {}) {
  const {
    featureRegistry = createFeatureRegistry(),
    serverRegistry = createServerPluginRegistry(),
    disabledPlugins = new Set(),
    serverDependencies = {},
  } = options;

  const enabledPlugins = "enabledPlugins" in options
    ? options.enabledPlugins
    : new Set(BUILTIN_SERVER_PLUGINS.map((p) => p.id));

  async function load(app, loadDependencies = {}) {
    const mergedDependencies = { ...serverDependencies, ...loadDependencies };
    const results = [];

    for (const pluginDef of BUILTIN_SERVER_PLUGINS) {
      const pluginId = pluginDef.id;

      if (disabledPlugins.has(pluginId)) {
        results.push({ pluginId, status: "disabled" });
        continue;
      }

      if (enabledPlugins !== undefined && !enabledPlugins.has(pluginId)) {
        results.push({ pluginId, status: "disabled" });
        continue;
      }

      if (!pluginDef.enabledByDefault) {
        results.push({ pluginId, status: "disabled" });
        continue;
      }

      const enabledFeatures = new Set(
        featureRegistry
          .getAll()
          .filter((f) => f.enabled)
          .map((f) => f.id),
      );

      const ctx = {
        manifest: {
          id: pluginDef.id,
          name: pluginDef.name,
          version: pluginDef.version,
          description: pluginDef.description,
          source: pluginDef.source,
          targets: pluginDef.targets,
          capabilities: pluginDef.capabilities,
          optionalCapabilities: pluginDef.optionalCapabilities,
          priority: pluginDef.priority,
          required: pluginDef.required,
        },
        capabilities: {
          granted: [...pluginDef.capabilities, ...pluginDef.optionalCapabilities],
          denied: [],
          has: (cap) =>
            pluginDef.capabilities.includes(cap) ||
            pluginDef.optionalCapabilities.includes(cap),
        },
        server: {
          routes: (routeId, registerFn, routeOptions = {}) => {
            const phase = routeOptions.phase ?? "postAuthFeatureRoutes";
            const featureId = routeOptions.featureId;

            serverRegistry.registerRoutes(routeId, (router) => {
              registerFn(router);
            }, pluginDef.id, pluginDef.source, {
              phase,
              featureId,
              priority: routeOptions.priority ?? 0,
            });
          },
          middleware: (middlewareId, middlewareFn, middlewareOptions = {}) => {
            const phase = middlewareOptions.phase ?? "earlyMiddleware";
            serverRegistry.registerMiddleware(
              middlewareId,
              middlewareFn,
              pluginDef.id,
              pluginDef.source,
              {
                phase,
                featureId: middlewareOptions.featureId,
                priority: middlewareOptions.priority ?? 0,
              },
            );
          },
          lifecycle: (hook, fn) => {
            serverRegistry.registerLifecycle(hook, fn, pluginDef.id);
          },
          dependencies: mergedDependencies,
        },
      };

      try {
        await pluginDef.setup(ctx);

        results.push({
          pluginId,
          status: "ready",
          contributionCount: serverRegistry.getContributionCount(),
        });
      } catch (error) {
        const message = error?.message || String(error);

        if (pluginDef.required) {
          throw error;
        }

        results.push({
          pluginId,
          status: "error",
          error: message,
        });
      }
    }

    return {
      results,
      serverRegistry,
      featureRegistry,
    };
  }

  return {
    load,
    getBuiltinPlugins: () => BUILTIN_SERVER_PLUGINS,
    getFeatureRegistry: () => featureRegistry,
    getServerRegistry: () => serverRegistry,
  };
}
