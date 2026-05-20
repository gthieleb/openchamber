export const GITHUB_PLUGIN_ID = "openchamber.plugin.github";
export const GITHUB_FEATURE_ID = "openchamber.feature.github";

export function registerServerPlugin(ctx: {
  server: {
    routes: (id: string, register: (router: unknown) => void, options?: { phase?: string; featureId?: string }) => void;
    lifecycle: (hook: string, fn: () => void) => void;
    getRuntimeDependency: (name: string) => unknown;
    dependencies: Record<string, unknown>;
  };
}) {
  const { registerGitHubRoutes } = ctx.server.dependencies as Record<string, unknown>;

  if (typeof registerGitHubRoutes === "function") {
    ctx.server.routes("openchamber.plugin.github.routes", (router) => {
      (registerGitHubRoutes as (router: unknown) => void)(router);
    }, {
      phase: "postAuthFeatureRoutes",
      featureId: GITHUB_FEATURE_ID,
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
    settingsPage: (slug: string, config: {
      title: string;
      group: "appearance" | "projects" | "general" | "opencode" | "git" | "skills" | "usage" | "advanced";
      kind?: "single" | "split";
      description?: string;
      keywords?: string[];
      icon?: React.ComponentType<{ className?: string }> | null;
      isAvailable?: (ctx: { isVSCode: boolean; isWeb: boolean; isDesktop: boolean }) => boolean;
      renderSidebar?: React.ComponentType<{ onItemSelect?: () => void }>;
      renderContent: React.ComponentType;
      priority?: number;
      featureId?: string;
      isCore?: boolean;
    }) => void;
  };
}, components: { GitHubSettings: React.ComponentType }) {
  ctx.ui.settingsPage("github", {
    title: "GitHub",
    group: "opencode",
    kind: "single",
    description: "GitHub authentication and repository integration",
    keywords: ["github", "pr", "pull request", "issues", "repository"],
    renderContent: components.GitHubSettings,
    featureId: GITHUB_FEATURE_ID,
    priority: 100,
  });
}
