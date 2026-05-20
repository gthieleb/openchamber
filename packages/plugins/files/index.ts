export const FILES_PLUGIN_ID = "openchamber.plugin.files";
export const FILES_FEATURE_ID = "openchamber.feature.files";

export function registerServerPlugin(ctx: {
  server: {
    routes: (id: string, register: (router: unknown) => void, options?: { phase?: string; featureId?: string }) => void;
    lifecycle: (hook: string, fn: () => void) => void;
    getRuntimeDependency: (name: string) => unknown;
    dependencies: Record<string, unknown>;
  };
}) {
  const { registerFsRoutes, ...fsDeps } = ctx.server.dependencies as Record<string, unknown>;

  if (typeof registerFsRoutes === "function") {
    ctx.server.routes("openchamber.plugin.files.routes", (router) => {
      (registerFsRoutes as (router: unknown, deps: Record<string, unknown>) => void)(router, fsDeps);
    }, {
      phase: "postAuthFeatureRoutes",
      featureId: FILES_FEATURE_ID,
    });
  }
}

export function registerUIPlugin(ctx: {
  ui: {
    surface: (id: string, config: {
      title: string;
      placements: string[];
      render: React.ComponentType<unknown>;
      featureId?: string;
      priority?: number;
      isCore?: boolean;
    }) => void;
    slot: (id: string, config: {
      render: React.ComponentType<unknown>;
      featureId?: string;
    }) => void;
  };
}, components: { FilesView: React.ComponentType<unknown>; FilesRightPanel: React.ComponentType<unknown> }) {
  ctx.ui.surface("files.view", {
    title: "Files",
    placements: ["workbench.main"],
    render: components.FilesView,
    featureId: FILES_FEATURE_ID,
    priority: 50,
    isCore: true,
  });

  ctx.ui.slot("workbench.right-panel.files", {
    render: components.FilesRightPanel,
    featureId: FILES_FEATURE_ID,
  });
}
