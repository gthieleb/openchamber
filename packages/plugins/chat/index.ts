export const CHAT_PLUGIN_ID = "openchamber.plugin.chat";
export const CHAT_FEATURE_ID = "openchamber.feature.chat";

export function registerServerPlugin(ctx: {
  server: {
    routes: (id: string, register: (router: unknown) => void, options?: { phase?: string; featureId?: string }) => void;
    lifecycle: (hook: string, fn: () => void) => void;
    getRuntimeDependency: (name: string) => unknown;
  };
}) {
  // Chat routes are handled by OpenCode server proxy
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
}, components: { ChatView: React.ComponentType<unknown> }) {
  ctx.ui.surface("chat.view", {
    title: "Chat",
    placements: ["workbench.main"],
    render: components.ChatView,
    priority: 0,
    isCore: true,
  });
}
