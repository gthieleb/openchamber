import React from "react";

export const HELLO_WORLD_PLUGIN_ID = "openchamber.plugin.hello-world";
export const HELLO_WORLD_FEATURE_ID = "openchamber.feature.hello-world";

const HelloWorldSettings: React.FC = () => {
  return React.createElement("div", { style: { padding: "2rem", maxWidth: "600px" } },
    React.createElement("h2", { style: { fontSize: "1.5rem", fontWeight: 600, marginBottom: "1rem" } },
      "Hello World Plugin"
    ),
    React.createElement("p", { style: { color: "var(--text-muted)", marginBottom: "1.5rem" } },
      "This is a custom plugin registered through the OpenChamber plugin system."
    ),
    React.createElement("div", {
      style: {
        padding: "1rem",
        borderRadius: "0.5rem",
        border: "1px solid var(--border-subtle)",
        backgroundColor: "var(--surface-subtle)",
      }
    },
      React.createElement("p", { style: { marginBottom: "0.5rem" } },
        React.createElement("strong", null, "Plugin ID: "), HELLO_WORLD_PLUGIN_ID
      ),
      React.createElement("p", { style: { marginBottom: "0.5rem" } },
        React.createElement("strong", null, "Feature ID: "), HELLO_WORLD_FEATURE_ID
      ),
      React.createElement("p", null,
        React.createElement("strong", null, "Status: "),
        React.createElement("span", { style: { color: "var(--status-success)" } }, "Active")
      )
    )
  );
};

const HelloWorldView: React.FC = () => {
  return React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      height: "100%",
      padding: "2rem",
    }
  },
    React.createElement("div", { style: { fontSize: "4rem", marginBottom: "1rem" } }, "👋"),
    React.createElement("h1", { style: { fontSize: "2rem", fontWeight: 700, marginBottom: "0.5rem" } },
      "Hello World!"
    ),
    React.createElement("p", { style: { color: "var(--text-muted)", maxWidth: "400px", textAlign: "center" } },
      "This tab was registered by a custom plugin. The plugin system is working!"
    ),
    React.createElement("div", {
      style: {
        marginTop: "2rem",
        padding: "1rem",
        borderRadius: "0.5rem",
        border: "1px solid var(--border-subtle)",
        backgroundColor: "var(--surface-subtle)",
        fontFamily: "monospace",
        fontSize: "0.875rem",
      }
    },
      React.createElement("div", null, `plugin: ${HELLO_WORLD_PLUGIN_ID}`),
      React.createElement("div", null, `feature: ${HELLO_WORLD_FEATURE_ID}`)
    )
  );
};

export function registerServerPlugin(ctx: {
  server: {
    routes: (id: string, register: (router: unknown) => void, options?: { phase?: string; featureId?: string }) => void;
    lifecycle: (hook: string, fn: () => void) => void;
    getRuntimeDependency: (name: string) => unknown;
    dependencies: Record<string, unknown>;
  };
}) {
  // No server routes for this demo plugin
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
}, _components: Record<string, never>) {
  // Register a main tab surface
  ctx.ui.surface("hello-world.main-tab", {
    title: "Hello World",
    placements: ["workbench.main"],
    render: HelloWorldView as React.ComponentType<unknown>,
    featureId: HELLO_WORLD_FEATURE_ID,
    priority: 999,
    isCore: false,
  });

  // Register a settings page
  ctx.ui.settingsPage("hello-world", {
    title: "Hello World",
    group: "advanced",
    kind: "single",
    description: "Hello World demo plugin",
    keywords: ["hello", "world", "demo", "plugin", "test"],
    renderContent: HelloWorldSettings as React.ComponentType,
    featureId: HELLO_WORLD_FEATURE_ID,
    priority: 999,
    isCore: false,
  });
}
