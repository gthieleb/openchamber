# OpenChamber Plugin Authoring Guide

This guide explains how to create bundled plugins for OpenChamber. Plugins extend the UI and server with contributions like surfaces, slots, commands, settings pages, tool renderers, and server routes.

## Overview

OpenChamber plugins are **build-time bundled** — they are compiled into the application at build time, not loaded dynamically at runtime. This ensures type safety, security, and performance.

### Plugin Structure

A plugin is a directory with this shape:

```
my-plugin/
├── plugin.json          # Plugin manifest
├── src/
│   ├── index.ts         # Plugin entry point (UI + server)
│   └── ...
└── package.json         # Dependencies (optional)
```

### Plugin Manifest (`plugin.json`)

```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "A custom plugin for OpenChamber",
  "targets": ["ui", "server"],
  "capabilities": ["ui.fill", "ui.surface", "server.route"],
  "optionalCapabilities": ["storage.global"],
  "priority": 0,
  "uiEntry": "./src/index.ts",
  "serverEntry": "./src/server.js"
}
```

| Field | Required | Description |
|---|---|---|
| `id` | Yes | Unique plugin identifier (lowercase, hyphens) |
| `name` | Yes | Human-readable name |
| `version` | Yes | Semver version |
| `description` | No | Short description |
| `targets` | Yes | `ui`, `server`, `vscode-extension-host`, `electron-main` |
| `capabilities` | Yes | List of capability IDs the plugin needs |
| `optionalCapabilities` | No | Capabilities that are nice-to-have |
| `priority` | No | Load order priority (higher = later) |
| `uiEntry` | Conditional | Required if `targets` includes `ui` |
| `serverEntry` | Conditional | Required if `targets` includes `server` |

## UI Contributions

### Surfaces

Surfaces are top-level views (like tabs in the main workbench).

```ts
import { definePlugin } from "@openchamber/plugin";

export default definePlugin({
  id: "my-plugin",
  name: "My Plugin",
  version: "1.0.0",
  targets: ["ui"],
  capabilities: ["ui.surface"],
  setup(ctx) {
    ctx.ui.surface("my-plugin.view", {
      title: "My View",
      placements: ["workbench.main"],
      render: MyViewComponent,
    });
  },
});
```

**Supported placements:**
- `workbench.main` — Main content area
- `workbench.bottom-dock` — Bottom panel
- `workbench.right-panel` — Right sidebar

### Slot Fills

Slots add content into existing UI areas.

```ts
ctx.ui.fill("workbench.right-panel", MySidebarWidget, {
  priority: 10,
});
```

### Commands

Register actions in the command palette.

```ts
ctx.commands.register("my-plugin.doSomething", {
  title: "Do Something",
  group: "general",
  run: () => {
    console.log("Command executed");
  },
});
```

### Settings Pages

Add a page to Settings.

```ts
ctx.settings.page("my-plugin.settings", {
  title: "My Plugin",
  render: MySettingsPage,
});
```

### Tool Renderers

Custom rendering for tool calls in chat.

```ts
ctx.tools.registerRenderer("my-custom-tool", {
  render: MyToolRenderer,
  icon: "tool-icon",
  presentation: "expandable",
});
```

## Server Contributions

### Routes

Register protected API routes.

```js
export default function myServerPlugin(ctx) {
  ctx.server.routes("my-plugin.api", (router) => {
    router.get("/api/my-plugin/data", (req, res) => {
      res.json({ message: "Hello from plugin" });
    });
  }, { phase: "postAuthFeatureRoutes" });
}

myServerPlugin.__definition = {
  id: "my-plugin",
  name: "My Plugin",
  version: "1.0.0",
  targets: ["server"],
  capabilities: ["server.route"],
};
```

**Available route phases:**

| Phase | Description |
|---|---|
| `preAuthPublicRoutes` | Public routes before auth check |
| `authRoutes` | Auth-specific routes |
| `postAuthFeatureRoutes` | Protected routes (default) |
| `preOpenCodeProxy` | Before OpenCode proxy |
| `postProxyRoutes` | After proxy |
| `staticAssets` | Static file serving |
| `spaFallback` | SPA fallback route |

### Middleware

```js
ctx.server.middleware("my-plugin.auth", myMiddleware, {
  phase: "earlyMiddleware",
});
```

### Lifecycle Hooks

```js
ctx.server.lifecycle("afterListen", () => {
  console.log("Server is listening");
});
```

**Available hooks:** `beforeRoutes`, `afterRoutes`, `beforeListen`, `afterListen`, `beforeShutdown`, `afterShutdown`.

## Storage

### Global Storage

Persists data across sessions.

```ts
const storage = ctx.storage;
storage.set("myKey", { value: 42 });
const data = storage.get("myKey");
storage.delete("myKey");
```

### Workspace Storage

Persists data per workspace directory.

```ts
ctx.storage.set("workspaceConfig", { theme: "dark" });
```

**Quotas:** Global: 1000 entries / 10MB. Workspace: 500 entries / 5MB.

## Capabilities Reference

### UI Capabilities

| Capability | Description |
|---|---|
| `ui.fill` | Add content to slots |
| `ui.surface` | Register top-level surfaces |
| `ui.replace` | Replace existing UI components |
| `ui.wrap` | Wrap existing UI components |
| `ui.slot` | Define new slots |
| `ui.renderer` | Register tool renderers |
| `ui.command` | Register commands |

### Server Capabilities

| Capability | Description |
|---|---|
| `server.route` | Register API routes |
| `server.middleware` | Register middleware |
| `server.lifecycle` | Register lifecycle hooks |
| `server.event` | Subscribe to server events |

### Other Capabilities

| Capability | Description |
|---|---|
| `settings.page` | Register settings pages |
| `settings.schema` | Register settings schemas |
| `storage.global` | Use global storage |
| `storage.workspace` | Use workspace storage |
| `fs.read` | Read files |
| `fs.write` | Write files (dangerous) |
| `fs.exec` | Execute commands (dangerous) |
| `git.read` | Read git state |
| `git.write` | Modify git state (dangerous) |
| `notifications` | Send notifications |
| `model.policy` | Filter/decorate models |

**Dangerous capabilities** (`fs.write`, `fs.exec`, `git.write`) require explicit user approval and are flagged in diagnostics.

## Building a Plugin

1. Create your plugin directory with `plugin.json` and source files.
2. Add the plugin to `packages/plugin/src/bundled-plugins/` and register it in the bundled plugin config.
3. Run `bun run type-check` and `bun run lint` to validate.
4. Run `bun run build` to verify the build includes your plugin.

## Constraints

- **No remote code loading.** Plugins are bundled at build time only.
- **React is shared.** Do not bundle your own React — use it as a peer dependency.
- **No arbitrary localStorage.** Use `ctx.storage` for persistence.
- **No raw bridge access.** Use `ctx.runtime` for API access.
- **Server plugins are allowlisted.** Only paths in the allowlist can be loaded.
- **Policy is enforced server-side.** UI checks are for UX only.

## Diagnostics

Inspect loaded plugins via `GET /api/plugins` or `GET /api/plugins/:pluginId`.

Response includes:
- Plugin ID, name, version, source
- Enabled state and status (`ready`, `error`, `disabled`)
- Granted and denied capabilities
- Contribution count and details
- Setup errors (if any)

## Example: Complete Plugin

```ts
// index.ts
import { definePlugin } from "@openchamber/plugin";
import { MyView } from "./MyView";
import { MySettings } from "./MySettings";

export default definePlugin({
  id: "my-complete-plugin",
  name: "My Complete Plugin",
  version: "1.0.0",
  description: "Demonstrates all contribution types",
  targets: ["ui", "server"],
  capabilities: ["ui.surface", "ui.fill", "ui.command", "settings.page", "server.route", "storage.global"],
  priority: 0,
  setup(ctx) {
    // UI surface
    ctx.ui.surface("my-plugin.view", {
      title: "My View",
      placements: ["workbench.main"],
      render: MyView,
    });

    // Slot fill
    ctx.ui.fill("workbench.right-panel", MySidebarWidget, { priority: 10 });

    // Command
    ctx.commands.register("my-plugin.action", {
      title: "Run My Action",
      group: "general",
      run: () => ctx.storage.set("lastRun", Date.now()),
    });

    // Settings page
    ctx.settings.page("my-plugin.settings", {
      title: "My Plugin",
      render: MySettings,
    });
  },
});
```

```js
// server.js
export default function myServerPlugin(ctx) {
  ctx.server.routes("my-plugin.api", (router) => {
    router.get("/api/my-plugin/status", (req, res) => {
      res.json({ status: "ok" });
    });
  }, { phase: "postAuthFeatureRoutes" });

  ctx.server.lifecycle("afterListen", () => {
    console.log("[my-plugin] Server ready");
  });
}

myServerPlugin.__definition = {
  id: "my-complete-plugin",
  name: "My Complete Plugin",
  version: "1.0.0",
  targets: ["server"],
  capabilities: ["server.route", "server.lifecycle"],
};
```
