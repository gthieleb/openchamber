export const GIT_PLUGIN_ID = "openchamber.plugin.git";
export const GIT_FEATURE_ID = "openchamber.feature.git";

export function registerServerPlugin(ctx: {
  server: {
    routes: (id: string, register: (router: unknown) => void, options?: { phase?: string; featureId?: string }) => void;
    lifecycle: (hook: string, fn: () => void) => void;
    getRuntimeDependency: (name: string) => unknown;
    dependencies: Record<string, unknown>;
  };
}) {
  const { registerGitRoutes } = ctx.server.dependencies as Record<string, unknown>;

  if (typeof registerGitRoutes === "function") {
    ctx.server.routes("openchamber.plugin.git.routes", (router) => {
      (registerGitRoutes as (router: unknown) => void)(router);
    }, {
      phase: "postAuthFeatureRoutes",
      featureId: GIT_FEATURE_ID,
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
}, components: { GitView: React.ComponentType<unknown>; GitRightPanel: React.ComponentType<unknown> }) {
  ctx.ui.surface("git.view", {
    title: "Git",
    placements: ["workbench.main"],
    render: components.GitView,
    featureId: GIT_FEATURE_ID,
    priority: 20,
    isCore: true,
  });

  ctx.ui.slot("workbench.right-panel.git", {
    render: components.GitRightPanel,
    featureId: GIT_FEATURE_ID,
  });
}
