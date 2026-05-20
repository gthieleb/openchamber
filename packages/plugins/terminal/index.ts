export const TERMINAL_PLUGIN_ID = "openchamber.plugin.terminal";
export const TERMINAL_FEATURE_ID = "openchamber.feature.terminal";

export function registerServerPlugin(ctx: {
  server: {
    routes: (id: string, register: (router: unknown) => void, options?: { phase?: string; featureId?: string }) => void;
    lifecycle: (hook: string, fn: () => void) => void;
    getRuntimeDependency: (name: string) => unknown;
    dependencies: Record<string, unknown>;
  };
}) {
  // Terminal routes are created by createTerminalRuntime in startup-pipeline-runtime.js
  // Only register lifecycle hook for graceful shutdown
  ctx.server.lifecycle("beforeShutdown", () => {
    const terminalRuntime = ctx.server.getRuntimeDependency("terminalRuntime");
    if (terminalRuntime && typeof (terminalRuntime as { shutdown?: () => void }).shutdown === "function") {
      (terminalRuntime as { shutdown: () => void }).shutdown();
    }
  });
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
  };
}, components: { TerminalView: React.ComponentType<unknown> }) {
  ctx.ui.surface("terminal.shell", {
    title: "Terminal",
    placements: ["workbench.main", "workbench.bottom-dock"],
    render: components.TerminalView,
    featureId: TERMINAL_FEATURE_ID,
    priority: 0,
    isCore: true,
  });
}
