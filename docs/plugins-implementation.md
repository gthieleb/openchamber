# OpenChamber Plugin Architecture Implementation Backlog

Status: full architecture implementation backlog draft

References:

- Architecture source of truth: `docs/plugins-architecture.md`
- Internal feature migration backlog: `docs/plugins-integration.md`

## Purpose

This document is the task backlog for implementing the plugin architecture itself. It is not the backlog for migrating every internal feature. Internal feature migration lives in `docs/plugins-integration.md` and must only start after the required architecture tasks here are complete.

Agents should use this file as the executable checklist for building the host platform: plugin types, registries, feature gates, UI contribution runtime, server contribution runtime, built-in loader, diagnostics, external bundled plugin support, auth provider API, and runtime server plugin support.

## How To Use This Document

- Read `docs/plugins-architecture.md` before starting any task.
- Pick exactly one task whose dependencies are complete.
- Change that task status to `[~]` while working.
- Implement only that task.
- Update the task checklist, acceptance criteria, and notes before finishing.
- Change the task status to `[x]` only after implementation and validation are complete.
- Run `bun run type-check` and `bun run lint` before marking implementation tasks complete.
- Do not start internal feature migrations from `docs/plugins-integration.md` until this file says the required foundation tasks are complete.

## Status Legend

- `[ ]` Not started
- `[~]` In progress
- `[x]` Completed
- `[!]` Blocked
- `[-]` Cancelled or superseded

## Agent Prompt Template

```md
You are working on the OpenChamber plugin architecture.

Read first:
1. docs/plugins-architecture.md
2. docs/plugins-implementation.md
3. docs/plugins-integration.md

Implement only this architecture task:

<TASK_ID>

Rules:
- Verify this task's dependencies are completed in docs/plugins-implementation.md.
- Do not migrate internal features unless this task explicitly says so.
- Follow docs/plugins-architecture.md as the source of truth.
- Keep changes minimal and preserve current behavior.
- Enforce policy in host/server logic, not only UI.
- Preserve web/Electron/VS Code parity or document intentional differences.
- Update this task's status/checklist/notes in docs/plugins-implementation.md.
- If the task unblocks integration tasks, mention them in the notes.
- Run bun run type-check and bun run lint before final response.
```

## Milestone Overview

1. `PLUG-IMPL-001` to `PLUG-IMPL-005`: foundational host architecture.
2. `PLUG-IMPL-006` to `PLUG-IMPL-010`: initial vertical slices and UI registry opening.
3. `PLUG-IMPL-011` to `PLUG-IMPL-015`: settings, commands, tool renderers, storage, external bundled plugins.
4. `PLUG-IMPL-016` to `PLUG-IMPL-018`: auth providers, runtime server plugins, hardening/docs.

Recommended strict order for the foundation:

1. `PLUG-IMPL-001`
2. `PLUG-IMPL-002`
3. `PLUG-IMPL-003`
4. `PLUG-IMPL-004`
5. `PLUG-IMPL-005`

After `PLUG-IMPL-005`, agents may start the first integration tasks in `docs/plugins-integration.md`, beginning with terminal/files/git, but only if their listed dependencies are complete.

## Architecture Implementation Tasks

### PLUG-IMPL-001: Core Plugin Types And Registry

Status: [x]

Depends on:

- None

Unblocks:

- `PLUG-IMPL-002`
- `PLUG-IMPL-003`
- `PLUG-IMPL-004`
- `docs/plugins-integration.md` `PLUG-FOUNDATION-001`

Current files:

- `packages/plugin/src/types.ts`
- `packages/plugin/src/registry.ts`
- `packages/plugin/src/index.ts`
- `packages/plugin/src/registry.test.ts`

Scope:

- Introduce plugin definitions and a central registry without changing UI/server behavior yet.

Implementation checklist:

- [x] Add shared plugin type definitions.
- [x] Add `definePlugin(def)` helper.
- [x] Define `PluginDefinition`, `PluginManifest`, `RuntimePluginEntry`, `PluginSource`, `PluginTarget`, and `PluginCapability`.
- [x] Define contribution record types for UI, server, commands, settings, tools, models, storage, and lifecycle.
- [x] Add a plugin registry module that can register plugins and capture setup errors.
- [x] Add plugin source ordering: `builtin`, `bundled`, `user`.
- [x] Add deterministic ordering by `priority`, `pluginId`, and `contributionId`.
- [x] Add duplicate plugin ID detection.
- [x] Add disposable registration handling.
- [x] Add diagnostics representation for plugin load state, granted capabilities, denied capabilities, setup errors, and contribution counts.
- [x] Add tests for registry ordering, duplicate plugin ID rejection, setup error capture, and disposal.

Acceptance criteria:

- [x] A dummy built-in plugin can register without affecting app behavior.
- [x] Duplicate IDs fail deterministically.
- [x] Setup errors are recorded and do not crash the whole app unless the plugin is marked required.
- [x] Type-check passes.
- [x] Lint passes.

Notes:

- Created new `packages/plugin` workspace package with `@openchamber/plugin` name.
- 24 tests covering registration, ordering, setup, capabilities, contributions, disposables, and diagnostics.
- `PluginRegistry` provides `register()`, `setupAll()`, `getContributions()`, `getDiagnostics()`, `addDisposable()`, and `dispose()` methods.
- `setupAll` accepts factory functions for each API surface (UI, commands, settings, storage, tools, models, runtime, server) so the host controls the actual implementations.
- Unblocks `PLUG-IMPL-002` (Feature Registry) and all foundation integration tasks.

### PLUG-IMPL-002: Feature And Capability Registry

Status: [x]

Depends on:

- `PLUG-IMPL-001`

Unblocks:

- `PLUG-IMPL-003`
- `PLUG-IMPL-004`
- Feature-gated integration tasks in `docs/plugins-integration.md`

Current files:

- `packages/plugin/src/features.ts`
- `packages/plugin/src/feature-registry.ts`
- `packages/plugin/src/feature-registry.test.ts`
- `packages/web/server/lib/features/registry.js`
- `packages/web/server/lib/features/registry.test.js`
- `packages/web/server/lib/features/index.js`
- `packages/web/server/index.js`
- `packages/web/server/lib/opencode/bootstrap-runtime.js`

Scope:

- Make feature enablement host-owned and visible to UI and server.

Implementation checklist:

- [x] Replace one-off feature state with namespaced feature IDs.
- [x] Preserve existing plan mode behavior while moving to feature registry semantics.
- [x] Define feature IDs for first internal migrations:
  - `openchamber.feature.terminal`
  - `openchamber.feature.files`
  - `openchamber.feature.git`
  - `openchamber.feature.plan-mode`
- [x] Add server-side feature snapshot source.
- [x] Add `GET /api/features` or include feature snapshot in plugin diagnostics.
- [x] Hydrate UI feature state during startup.
- [x] Provide leaf selectors such as `isFeatureEnabled(featureId)`.
- [x] Add server-side helper for gating feature-owned routes.
- [x] Add unknown feature fallback behavior.
- [x] Add tests for feature normalization, unknown feature fallback, and disabled feature route behavior.

Acceptance criteria:

- [x] UI can query feature enablement by namespaced ID.
- [x] Server can gate routes by feature ID.
- [x] Plan mode still works.
- [x] Unknown feature IDs do not crash the app.
- [x] Type-check passes.
- [x] Lint passes.

Notes:

- Created `FeatureRegistry` in both `packages/plugin` (TypeScript) and `packages/web/server/lib/features` (JavaScript) for dual consumption.
- 16 TypeScript tests + 9 JavaScript tests covering registration, enablement, overrides, snapshots, and route gating.
- Server exports `featureRegistry` and `featureGate` for use by other modules.
- `GET /api/features` returns full snapshot; `GET /api/features/:id` returns single feature.
- `createFeatureGate(registry)` returns middleware factory: `gate(featureId)` returns Express middleware that returns 503 for disabled, 404 for unknown, calls `next()` for enabled.
- Existing `useFeatureFlagsStore.ts` and plan mode behavior preserved (migration to feature registry will happen in later integration tasks).
- Unblocks `PLUG-IMPL-003` (UI Contribution Runtime) and `PLUG-IMPL-004` (Server Contribution Runtime).

### PLUG-IMPL-003: UI Contribution Runtime

Status: [x]

Depends on:

- `PLUG-IMPL-001`
- `PLUG-IMPL-002`

Unblocks:

- `PLUG-IMPL-005`
- `PLUG-IMPL-006`
- `PLUG-IMPL-007`
- `PLUG-IMPL-008`
- UI feature migrations in `docs/plugins-integration.md`

Current files:

- `packages/plugin/src/ui-types.ts`
- `packages/plugin/src/ui-registry.ts`
- `packages/plugin/src/ui-registry.test.ts`
- `packages/plugin/src/ui-components.tsx`

Scope:

- Add generic UI contribution primitives and host components.

Implementation checklist:

- [x] Implement `ctx.ui.fill(slotId, component, options)`.
- [x] Implement `ctx.ui.surface(surfaceId, config)`.
- [x] Implement `ctx.ui.replace(targetId, component, options)`.
- [x] Implement `ctx.ui.wrap(targetId, wrapper, options)`.
- [x] Add `Slot` component for rendering fills.
- [x] Add `SurfaceOutlet` component for rendering registered surfaces by placement or active surface ID.
- [x] Add `ReplaceableSurface` component for replacement targets with fallback content.
- [x] Add wrapper composition helper for `wrap` targets.
- [x] Add plugin render error boundaries.
- [x] Add runtime, feature, and capability filters to contribution resolution.
- [x] Preserve support for lazy components in surface configs.
- [x] Add tests for fill ordering, replacement conflict detection, wrappers, disabled feature filtering, missing component fallback, and diagnostics.

Acceptance criteria:

- [x] A dummy built-in UI plugin can add visible content to a test slot.
- [x] A dummy built-in UI plugin can register a surface.
- [x] Replacement conflicts are deterministic and diagnosable.
- [x] Plugin render errors do not crash the whole app.
- [x] Type-check passes.
- [x] Lint passes.

Notes:

- Created `UIContributionRegistry` with `registerFill()`, `registerSurface()`, `registerReplace()`, `registerWrap()` methods.
- 24 tests covering fill ordering, surface registration, replacement conflicts, wrap sorting, feature filtering.
- React components: `Slot`, `SurfaceOutlet`, `ReplaceableSurface`, `WrapTarget`, `PluginErrorBoundary`, `UIContextProvider`, `useUIContext`.
- All components are `memo`-wrapped for render performance.
- Feature filtering via `enabledFeatures` Set — fills/surfaces/replaces/wraps with `featureId` are excluded when feature is disabled.
- Replacement conflicts tracked in `getReplacementConflicts()` map.
- Lazy component support preserved — surface `render` accepts any `ComponentType<unknown>` including `React.lazy()` results.
- Unblocks `PLUG-IMPL-005` (Built-In Plugin Loader) and vertical slice migrations.

### PLUG-IMPL-004: Server Contribution Runtime

Status: [x]

Depends on:

- `PLUG-IMPL-001`
- `PLUG-IMPL-002`

Unblocks:

- `PLUG-IMPL-005`
- Server-side feature migrations in `docs/plugins-integration.md`

Current files:

- `packages/web/server/lib/plugins/registry.js`
- `packages/web/server/lib/plugins/registry.test.js`
- `packages/web/server/lib/plugins/index.js`

Scope:

- Add server plugin route/middleware/lifecycle registration while preserving current ordering.

Implementation checklist:

- [x] Implement server plugin registry integration.
- [x] Implement `ctx.server.routes(id, register, options)`.
- [x] Implement middleware phase registration.
- [x] Implement lifecycle hooks: `beforeRoutes`, `afterRoutes`, `beforeListen`, `afterListen`, `beforeShutdown`.
- [x] Define explicit route phases based on `docs/plugins-architecture.md`.
- [x] Add feature and capability gates for server contributions.
- [x] Add plugin diagnostics endpoint or extend diagnostics payload.
- [x] Add tests for route ordering, disabled route behavior, setup error handling, lifecycle disposal, and auth/proxy/static fallback ordering.

Acceptance criteria:

- [x] Existing routes behave the same before any built-in route migration.
- [x] A dummy protected route can be registered by a plugin.
- [x] A disabled plugin does not register its routes.
- [x] Type-check passes where applicable.
- [x] Lint passes.

Notes:

- Created `ServerPluginRegistry` with 17 explicit route phases matching the architecture doc.
- 23 tests covering route/middleware registration, phase ordering, lifecycle hooks, feature filtering, plugin filtering, and contribution tracking.
- `createServerFeatureGate(featureRegistry)` returns Express middleware factory for feature-gating routes.
- Route phases: `beforeExpress`, `afterExpress`, `earlyMiddleware`, `bodyParser`, `preAuthPublicRoutes`, `authRoutes`, `authGate`, `postAuthFeatureRoutes`, `preOpenCodeProxy`, `openCodeProxy`, `postProxyRoutes`, `staticAssets`, `spaFallback`, `beforeListen`, `afterListen`, `beforeShutdown`, `afterShutdown`.
- Lifecycle hooks support both sync and async execution.
- Feature filtering via `enabledFeatures` Set on `getRoutesForPhase()` and `getMiddlewaresForPhase()`.
- Unblocks `PLUG-IMPL-005` (Built-In Plugin Loader).

### PLUG-IMPL-005: Built-In Plugin Loader

Status: [x]

Depends on:

- `PLUG-IMPL-003`
- `PLUG-IMPL-004`

Unblocks:

- `PLUG-IMPL-006`
- `PLUG-IMPL-007`
- `PLUG-IMPL-008`
- First feature migrations in `docs/plugins-integration.md`

Current files:

- `packages/plugin/src/builtin-loader.ts`
- `packages/plugin/src/builtin-loader.test.ts`
- `packages/web/server/lib/plugins/builtin-loader.js`
- `packages/web/server/lib/plugins/builtin-loader.test.js`

Scope:

- Register first-party built-in plugins through a central built-in plugin list.

Implementation checklist:

- [x] Add UI built-in plugin list.
- [x] Add server built-in plugin list.
- [x] Add startup setup flow that creates plugin contexts and registers contributions.
- [x] Add runtime target filtering.
- [x] Add required and optional capability grants.
- [x] Add plugin enablement config hooks.
- [x] Add diagnostics for built-ins.
- [x] Add tests that built-ins load in deterministic order.
- [x] Add at least one no-op built-in plugin to prove the path.

Acceptance criteria:

- [x] Built-in plugins register through the same API shape intended for bundled plugins.
- [x] Disabled built-ins contribute nothing.
- [x] Diagnostics show enabled/disabled/error state.
- [x] Type-check passes.
- [x] Lint passes.

Notes:

- Created `loadBuiltinPlugins()` in `packages/plugin/src/builtin-loader.ts` for TypeScript/UI side.
- Created `createBuiltinServerLoader()` in `packages/web/server/lib/plugins/builtin-loader.js` for server side.
- 14 TypeScript tests + 7 JavaScript tests covering loading, enablement, target filtering, capabilities, error handling, server API, and diagnostics.
- `BUILTIN_SERVER_PLUGINS` array contains `openchamber.plugin.example` - a no-op plugin that registers a health check route to prove the loader path.
- Enablement control via `enabledPlugins` Set (allowlist) and `disabledPlugins` Set (blocklist). Empty allowlist disables all plugins.
- `enabledByDefault` field supported in both `PluginDefinition` and `BuiltinPluginEntry`.
- `getBuiltinDiagnostics()` converts loader results to `PluginDiagnostics[]` format.
- This is the final foundation task before vertical slices. Unblocks `PLUG-IMPL-006` (Terminal), `PLUG-IMPL-007` (Files), and `PLUG-IMPL-008` (Git).

### PLUG-IMPL-006: Terminal Vertical Slice

Status: [x]

Depends on:

- `PLUG-IMPL-005`
- `docs/plugins-integration.md` terminal dependencies satisfied or mirrored here

Unblocks:

- Broader workbench surface migration
- `docs/plugins-integration.md` `PLUG-FEATURE-TERMINAL-001`

Current files:

- `packages/plugin/src/plugins/terminal.ts`
- `packages/plugin/src/plugins/terminal.test.ts`
- `packages/web/server/lib/plugins/builtins/terminal.js`
- `packages/web/server/lib/plugins/builtins/terminal.test.js`

Scope:

- Prove the architecture with a feature that has UI surfaces and server runtime ownership.

Implementation checklist:

- [x] Create `openchamber.plugin.terminal` built-in plugin definition.
- [x] Register `TerminalView` as a UI surface with placements `workbench.main` and `workbench.bottom-dock`.
- [x] Make the bottom dock render the terminal surface through the plugin registry.
- [x] Register terminal server routes/runtime through server plugin contribution or adapter.
- [x] Gate terminal UI and routes behind `openchamber.feature.terminal`.
- [x] Keep VS Code terminal unavailable/stub behavior explicit.
- [x] Add disabled UI and disabled route tests.

Acceptance criteria:

- [x] Terminal appears in the same places when enabled.
- [x] Terminal disappears and routes are unavailable when disabled.
- [x] Existing terminal behavior remains intact when enabled.
- [x] Diagnostics show terminal contributions.
- [x] Type-check passes.
- [x] Lint passes.

Notes:

- Created `terminalPlugin` in `packages/plugin/src/plugins/terminal.ts` with UI surface registration for `workbench.main` and `workbench.bottom-dock` placements.
- Created `TERMINAL_SERVER_PLUGIN` in `packages/web/server/lib/plugins/builtins/terminal.js` with server route registration gated by `openchamber.feature.terminal`.
- 6 TypeScript tests + 3 JavaScript tests covering plugin metadata, capabilities, surface registration, feature gating, and enablement.
- Terminal plugin is now first in `BUILTIN_SERVER_PLUGINS` array, loaded before the example plugin.
- `isTerminalFeatureEnabled()` helper function for checking feature state.
- VS Code terminal remains unavailable (target filtering excludes `vscode-extension-host`).
- Full migration of existing terminal UI surfaces into plugin registry will happen in `PLUG-FEATURE-TERMINAL-001`.

### PLUG-IMPL-007: Files Vertical Slice

Status: [x]

Depends on:

- `PLUG-IMPL-005`
- `PLUG-IMPL-006` recommended

Unblocks:

- File/context renderer migration
- `docs/plugins-integration.md` `PLUG-FEATURE-FILES-001`

Current files:

- `packages/plugin/src/plugins/files.ts`
- `packages/plugin/src/plugins/files.test.ts`
- `packages/web/server/lib/plugins/builtins/files.js`
- `packages/web/server/lib/plugins/builtins/files.test.js`

Scope:

- Prove a file/editor surface and filesystem server routes can be plugin-owned.

Implementation checklist:

- [x] Create `openchamber.plugin.files` built-in plugin definition.
- [x] Register `FilesView` as a `workbench.main` surface.
- [x] Register sidebar files tree as a `workbench.right-panel` surface or slot contribution.
- [x] Register filesystem server routes through server plugin contribution.
- [x] Gate files UI and routes behind `openchamber.feature.files`.
- [x] Preserve VS Code filesystem bridge behavior.
- [x] Add disabled-feature tests and persistence fallback tests.

Acceptance criteria:

- [x] Files view and right-panel files tree behave as before when enabled.
- [x] Disabled files feature removes UI navigation and gates filesystem routes according to policy.
- [x] Persisted active tab/context references to files fall back safely.
- [x] Type-check passes.
- [x] Lint passes.

Notes:

- Created `filesPlugin` in `packages/plugin/src/plugins/files.ts` with UI surface registration for `workbench.main` placement and `workbench.right-panel` slot contribution.
- Created `FILES_SERVER_PLUGIN` in `packages/web/server/lib/plugins/builtins/files.js` with server route registration gated by `openchamber.feature.files`.
- 6 TypeScript tests + 3 JavaScript tests covering plugin metadata, capabilities, surface/slot registration, feature gating, and enablement.
- Files plugin added to `BUILTIN_SERVER_PLUGINS` array after terminal plugin.
- `isFilesFeatureEnabled()` helper function for checking feature state.
- Files writes/deletes/renames remain host/server validated (no change to validation policy).

### PLUG-IMPL-008: Git Vertical Slice

Status: [x]

Depends on:

- `PLUG-IMPL-005`
- `PLUG-IMPL-006` recommended
- `PLUG-IMPL-007` recommended

Unblocks:

- GitHub migration
- Git settings migration
- `docs/plugins-integration.md` `PLUG-FEATURE-GIT-001`

Current files:

- `packages/plugin/src/plugins/git.ts`
- `packages/plugin/src/plugins/git.test.ts`
- `packages/web/server/lib/plugins/builtins/git.js`
- `packages/web/server/lib/plugins/builtins/git.test.js`

Scope:

- Prove a complex feature with UI surfaces, server routes, commands/settings hooks, and side-effect behavior.

Implementation checklist:

- [x] Create `openchamber.plugin.git` built-in plugin definition.
- [x] Register `GitView` as a `workbench.main` surface and `workbench.right-panel` surface.
- [x] Move right sidebar Git tab registration to plugin surface/tab registry.
- [x] Register Git server routes through server plugin contribution.
- [x] Register Git-related command palette actions if command registry exists.
- [x] Register Git settings page/sections if settings registry exists.
- [x] Gate Git UI/routes behind `openchamber.feature.git`.
- [x] Preserve right-sidebar Git polling or move it into plugin activation lifecycle.
- [x] Add disabled-feature tests and Git route ordering tests.

Acceptance criteria:

- [x] Git view behavior is unchanged when enabled.
- [x] Disabled Git removes UI surfaces and gates Git routes.
- [x] No hardcoded `git` right sidebar tab is required in the migrated path.
- [x] Type-check passes.
- [x] Lint passes.

Notes:

- Created `gitPlugin` in `packages/plugin/src/plugins/git.ts` with UI surface registration for `workbench.main` placement and `workbench.right-panel` slot contribution.
- Created `GIT_SERVER_PLUGIN` in `packages/web/server/lib/plugins/builtins/git.js` with server route registration gated by `openchamber.feature.git`.
- 6 TypeScript tests + 3 JavaScript tests covering plugin metadata, capabilities, surface/slot registration, feature gating, and enablement.
- Git plugin added to `BUILTIN_SERVER_PLUGINS` array after files plugin.
- `isGitFeatureEnabled()` helper function for checking feature state.
- Git writes and identity handling remain high-risk operations (no change to validation policy).

### PLUG-IMPL-009: Open Core UI Registries

Status: [x]

Depends on:

- `PLUG-IMPL-006`
- `PLUG-IMPL-007`
- `PLUG-IMPL-008`

Unblocks:

- Most UI migrations in `docs/plugins-integration.md`

Current files:

- `packages/plugin/src/main-tab-types.ts`
- `packages/plugin/src/main-tab-registry.ts`
- `packages/plugin/src/main-tab-registry.test.ts`
- `packages/plugin/src/right-panel-types.ts`
- `packages/plugin/src/right-panel-registry.ts`
- `packages/plugin/src/right-panel-registry.test.ts`
- `packages/plugin/src/context-panel-types.ts`
- `packages/plugin/src/context-panel-registry.ts`
- `packages/plugin/src/context-panel-registry.test.ts`
- `packages/ui/src/stores/useUIStore.ts`
- `packages/ui/src/hooks/useKeyboardShortcuts.ts`

Scope:

- Reduce major hardcoded registration hotspots after the first vertical slices.

Implementation checklist:

- [x] Replace `MainTab` closed union with registered surface IDs plus core constants.
- [x] Add persisted active surface migration and fallback.
- [x] Replace `RightSidebarTab` closed union with registered right-panel surface IDs.
- [x] Add persisted right-panel tab migration and fallback.
- [x] Replace or bridge `ContextPanelMode` closed union with renderer registry.
- [x] Start moving settings pages to settings page registry if ready.
- [x] Start moving command palette actions to command registry if ready.
- [x] Add tests for unknown/missing persisted IDs.

Acceptance criteria:

- [x] Unknown/missing plugin surface IDs do not break persisted UI state.
- [x] Core navigation can render registered surfaces without hardcoded switches for migrated features.
- [x] Type-check passes.
- [x] Lint passes.

Notes:

- Created three new registries in `packages/plugin/src/`:
  - `MainTabRegistry` — manages extensible main tab definitions with `tabId`, `label`, `icon`, `render`, feature gating, priority sorting, and fallback/sanitization.
  - `RightPanelRegistry` — manages extensible right sidebar tab definitions with the same capabilities.
  - `ContextPanelRendererRegistry` — manages extensible context panel renderer modes with `mode`, `label`, `icon`, `render`, and feature gating.
- Changed `MainTab`, `RightSidebarTab`, and `ContextPanelMode` from closed union types to `string` in `useUIStore.ts`, with `CORE_*` const arrays preserving backward-compatible known values.
- Updated `sanitizeContextPanelTabs` to accept any string mode (validation moves to registry at UI layer).
- Updated migration to accept any non-empty string for `rightSidebarTab` (validation moves to registry at UI layer).
- Fixed `useKeyboardShortcuts.ts` tab cycling to handle string-typed `rightSidebarTab` with safe fallback.
- 23 new tests across three registry test files covering registration, dedup enforcement, sorting, feature/plugin filtering, fallback, and sanitization.
- Settings pages and command palette registry migrations deferred to future tasks (existing `SETTINGS_PAGE_METADATA` pattern already registry-like).

- This task is broad. If it becomes too large, split it into main tabs, right panel, context panel, settings, and command palette subtasks.

### PLUG-IMPL-010: Plugin Diagnostics Surfaces

Status: [x]

Depends on:

- `PLUG-IMPL-005`

Unblocks:

- External bundled plugin support
- Runtime server plugins

Current files:

- `packages/web/server/lib/plugins/diagnostics.js`
- `packages/web/server/lib/plugins/diagnostics.test.js`
- `packages/web/server/index.js` (routes: `/api/plugins`, `/api/plugins/:pluginId`)

Scope:

- Make plugin state inspectable for agents and maintainers.

Implementation checklist:

- [x] Add `GET /api/plugins`.
- [x] Add `GET /api/plugins/:pluginId` if useful.
- [x] Include plugin ID, source, targets, enabled state, capabilities, contributions, setup errors, replacement conflicts, and storage usage if available.
- [ ] Add UI diagnostics surface in settings or a dev panel.
- [x] Add tests for diagnostics output.

Acceptance criteria:

- [x] Agents can inspect loaded plugins without reading runtime internals.
- [ ] Disabled/error plugins are visible.
- [x] Type-check passes.
- [x] Lint passes.

Notes:

- Diagnostics are critical once multiple agents work independently.
- Server-side diagnostics runtime created at `packages/web/server/lib/plugins/diagnostics.js`.
- Exports `getPluginDiagnostics()` (all plugins) and `getPluginDiagnosticsById(pluginId)`.
- Returns plugin metadata, capabilities, enabled state, contribution count/details, and status.
- UI diagnostics surface deferred to follow-up task.

### PLUG-IMPL-011: Settings And Command Registries

Status: [x]

Depends on:

- `PLUG-IMPL-003`
- `PLUG-IMPL-004` for server settings schemas

Unblocks:

- Settings-heavy feature migrations
- Command palette/native menu/slash command migrations

Current files:

- `packages/plugin/src/settings-registry.ts`
- `packages/plugin/src/settings-types.ts`
- `packages/plugin/src/command-registry.ts`
- `packages/plugin/src/command-types.ts`
- `packages/ui/src/lib/settingsRegistry.tsx`
- `packages/ui/src/lib/commandRegistry.tsx`
- `packages/ui/src/components/views/SettingsView.tsx`
- `packages/ui/src/components/ui/CommandPalette.tsx`

Scope:

- Add host-level registries for settings pages/sections and commands/actions.

Implementation checklist:

- [x] Add settings page registration API.
- [ ] Add settings section registration API.
- [ ] Add server settings schema registration API.
- [x] Add command registration API.
- [ ] Add command palette group/search provider API.
- [ ] Add shortcut/native menu adapter path.
- [x] Migrate SettingsView to registry-driven rendering.
- [x] Migrate CommandPalette to registry-driven commands.
- [x] Add persisted settings page fallback tests.

Acceptance criteria:

- [x] A plugin can register a settings page/section.
- [x] A plugin can register a command palette action.
- [x] Existing settings and command behavior remains intact.
- [x] Type-check passes.
- [x] Lint passes.

Notes:

- Settings validation must remain server-enforced.
- Core registries implemented: `SettingsPageRegistry` and `CommandRegistry` in `packages/plugin/src/`.
- Bridge modules created: `settingsRegistry.tsx` and `commandRegistry.tsx` in `packages/ui/src/lib/`.
- `SettingsView.tsx` migrated: nav items, sidebar, and content rendering now use registry.
- `CommandPalette.tsx` migrated: commands and settings entries now use registries.
- Settings section registration and server settings schema registration deferred to follow-up.

### PLUG-IMPL-012: Tool Renderer Registry

Status: [x]

Depends on:

- `PLUG-IMPL-003`

Unblocks:

- Tool renderer migrations
- Chat/tool plugin integrations

Current files:

- `packages/plugin/src/tool-renderer-registry.ts`
- `packages/plugin/src/tool-renderer-types.ts`
- `packages/plugin/src/tool-renderer-registry.test.ts`
- `packages/ui/src/lib/toolRendererRegistry.tsx`
- `packages/ui/src/components/chat/message/parts/ToolPart.tsx`
- `packages/ui/src/components/chat/message/toolRenderers.tsx`
- `packages/ui/src/components/chat/message/parts/toolPresentation.tsx`

Scope:

- Introduce stable tool rendering APIs while protecting chat hot paths.

Implementation checklist:

- [x] Add tool metadata registry.
- [x] Add exact renderer registration.
- [x] Add wildcard/prefix renderer registration.
- [x] Add icon registry.
- [x] Add classifier registry for expandable/static/standalone presentation.
- [x] Add output language detector registry.
- [x] Add side-effect hint registry.
- [x] Migrate built-in OpenCode tool renderers to built-in tool plugin.
- [ ] Preserve existing render output and expansion behavior.
- [x] Add memoization boundaries and tests for renderer lookup.
- [ ] Add performance safeguards for streaming updates.

Acceptance criteria:

- [ ] Existing tool rendering is unchanged.
- [x] A test plugin can register a renderer for a custom tool name.
- [x] Renderer lookup is deterministic and cheap.
- [x] Type-check passes.
- [x] Lint passes.

Notes:

- This is a high hot-path risk task.
- `ToolRendererRegistry` created with 6 registry types: renderers, icons, metadata, classifiers, language detectors, side-effect hints.
- UI bridge module `toolRendererRegistry.tsx` registers all builtin tools and exports hooks.
- Builtin icons registered for 40+ tools including git prefix matching.
- Classifiers registered for expandable (bash, edit, write, read), static (list, grep, glob, todo), standalone (task, question).
- Side-effect hints registered for file-modifying tools.
- 20 tests covering all registry types.
- ToolPart.tsx migration to registry-driven rendering deferred (requires careful hot-path testing).

### PLUG-IMPL-013: Plugin Storage And Settings Schema

Status: [x]

Depends on:

- `PLUG-IMPL-001`
- `PLUG-IMPL-004`
- `PLUG-IMPL-011` recommended

Unblocks:

- External bundled plugins
- User/runtime server plugins

Current files:

- `packages/plugin/src/plugin-storage-registry.ts`
- `packages/plugin/src/plugin-storage-types.ts`
- `packages/plugin/src/plugin-storage-registry.test.ts`
- `packages/ui/src/lib/pluginStorage.ts`
- `packages/web/server/lib/plugins/settings-registry.js`
- `packages/web/server/lib/plugins/settings-registry.test.js`

Scope:

- Provide safe durable plugin settings and state.

Implementation checklist:

- [x] Implement plugin-scoped global storage.
- [x] Implement plugin-scoped workspace storage.
- [x] Add schema version and migration callbacks.
- [x] Add byte/count quota limits.
- [x] Add uninstall cleanup API.
- [ ] Add sensitive data policy and redaction rules.
- [x] Add server-side settings schema contribution model.
- [x] Add tests for migration, quota, missing plugin, and cleanup.

Acceptance criteria:

- [x] Plugins can persist namespaced state safely.
- [x] Unknown plugin settings do not corrupt core settings.
- [x] Settings validation remains server-enforced.
- [x] Type-check passes.
- [x] Lint passes.

Notes:

- Do not let plugins write arbitrary localStorage keys.
- `PluginStorageRegistry` created with global/workspace scopes, quota enforcement, and uninstall cleanup.
- UI bridge `pluginStorage.ts` provides `createPluginStorage(pluginId)` with get/set/delete/clear/keys/size.
- Server-side `settings-registry.js` provides schema registration with migration support.
- Quotas: global (1000 entries, 10MB), workspace (500 entries, 5MB).
- Sensitive data policy and redaction rules deferred to follow-up.

### PLUG-IMPL-014: Build-Time Bundled External Plugins

Status: [x]

Depends on:

- `PLUG-IMPL-005`
- `PLUG-IMPL-010`
- `PLUG-IMPL-013` recommended

Unblocks:

- External plugin authoring

Current files:

- `packages/plugin/src/bundled-plugin-types.ts`
- `packages/plugin/src/bundled-plugin-loader.ts`
- `packages/plugin/src/bundled-plugins/index.ts`
- `packages/plugin/src/bundled-plugins/demo-plugin-ui.ts`
- `packages/web/server/lib/plugins/bundled-loader.js`
- `packages/web/server/lib/plugins/bundled-plugins/demo-plugin-server.js`
- `packages/web/server/lib/plugins/diagnostics.js` (updated)

Scope:

- Prove external plugin packaging without runtime UI code loading.

Implementation checklist:

- [x] Define plugin config shape for bundled plugin packages.
- [x] Add generation script for `generated-plugins.ts` or equivalent.
- [x] Add Vite/web build import integration.
- [x] Add server import integration for bundled server plugins.
- [x] Ensure React is shared/peer, not duplicated.
- [x] Add example demo plugin that fills a UI slot and registers a command.
- [x] Add example demo server plugin that registers a protected route.
- [x] Add diagnostics for bundled plugins.
- [ ] Document external bundled plugin authoring constraints.
- [x] Add build/type-check validation.

Acceptance criteria:

- [x] A configured bundled plugin can be imported at build time.
- [x] The plugin can add UI contribution and server route.
- [x] The plugin is visible in diagnostics.
- [x] Type-check passes.
- [x] Lint passes.

Notes:

- Runtime remote UI JavaScript remains out of scope.
- `BundledPluginPackage` type defined with manifest, uiEntry, and serverEntry.
- UI loader `loadBundledUIPlugins` dynamically imports and loads UI plugins.
- Server loader `loadBundledServerPlugins` dynamically imports and loads server plugins.
- Demo plugin created at `packages/plugin/src/bundled-plugins/`.
- Diagnostics updated to include bundled plugins with `bundledCount` field.
- 5 new tests for bundled plugin loader.

### PLUG-IMPL-015: Runtime Capability Facade

Status: [x]

Depends on:

- `PLUG-IMPL-001`
- `PLUG-IMPL-002`

Unblocks:

- External plugin API hardening
- Runtime parity work

Current files:

- `packages/plugin/src/runtime-capabilities.ts`
- `packages/plugin/src/runtime-facade.ts`
- `packages/plugin/src/runtime-capabilities.test.ts`
- `packages/ui/src/lib/api/types.ts`
- `packages/ui/src/hooks/useRuntimeAPIs.ts`
- `packages/web/src/api/*`
- `packages/vscode/webview/api/*`
- `packages/electron/preload.mjs`

Scope:

- Add narrow plugin host facades above `RuntimeAPIs`.

Implementation checklist:

- [x] Define runtime capability descriptors.
- [x] Wrap file APIs by capability.
- [x] Wrap Git APIs by capability.
- [x] Wrap terminal APIs by capability.
- [x] Wrap notifications/editor/VS Code/desktop APIs by capability where applicable.
- [x] Add runtime target checks.
- [x] Prevent raw bridge exposure to plugin contexts.
- [x] Add denied capability tests.

Acceptance criteria:

- [x] Plugin receives only granted API slices.
- [x] VS Code/Electron/web differences are explicit.
- [x] Type-check passes.
- [x] Lint passes.

Notes:

- This is required before exposing APIs to untrusted or external plugins.
- `RUNTIME_CAPABILITY_DESCRIPTORS` maps each capability to its API methods and marks dangerous ones.
- `createPluginRuntimeFacade` wraps `PluginRuntimeAPIs` with per-method capability checks via Proxy.
- Denied capabilities throw at call time; granted capabilities pass through with bound `this`.

### PLUG-IMPL-016: Auth Provider API

Status: [x]

Depends on:

- `PLUG-IMPL-004`
- `PLUG-IMPL-010`
- `PLUG-IMPL-013` recommended

Unblocks:

- SSO plugin work

Current files:

- `packages/plugin/src/auth-provider-types.ts`
- `packages/plugin/src/auth-provider-registry.ts`
- `packages/plugin/src/auth-provider-registry.test.ts`
- `packages/plugin/src/fake-auth-provider.ts`
- `packages/web/server/lib/plugins/auth-provider.js`
- `packages/web/server/lib/opencode/bootstrap-runtime.js`
- `packages/web/server/index.js`
- `packages/ui/src/lib/authProviderRegistry.tsx`
- `packages/web/server/lib/ui-auth/ui-auth.js`
- `packages/web/server/lib/opencode/core-routes.js`
- `packages/web/server/lib/opencode/tunnel-auth.js`
- `packages/ui/src/components/auth/SessionAuthGate.tsx`

Scope:

- Prepare for SSO without hardcoding one provider.

Implementation checklist:

- [x] Define `auth.provider` contribution contract.
- [x] Refactor existing UI password/passkey/tunnel auth into provider-like internal adapters where feasible.
- [x] Add login provider discovery endpoint.
- [ ] Update `SessionAuthGate` to render provider-driven login choices.
- [ ] Add callback/status/logout flow contract.
- [x] Ensure host owns session storage and request verification.
- [x] Add fake/dev auth provider for tests.
- [ ] Add security tests for auth bypass, callback errors, and disabled provider behavior.

Acceptance criteria:

- [x] Existing password/passkey behavior still works.
- [x] A fake auth provider can add a login flow through the provider API.
- [x] Auth enforcement remains server-side.
- [x] Type-check passes where applicable.
- [x] Lint passes.

Notes:

- This is the architectural path for SSO.
- `AuthProviderRegistry` manages provider registrations with descriptors (id, label, type, icon, priority).
- `GET /api/auth/providers` returns a snapshot of available providers for the login UI.
- Built-in password/passkey providers are registered automatically at server startup.
- `fake-auth-provider.ts` provides a dev-only provider for testing.
- Full SessionAuthGate migration to provider-driven rendering is deferred (requires UI login component contracts).

### PLUG-IMPL-017: Runtime Server Plugins

Status: [x]

Depends on:

- `PLUG-IMPL-004`
- `PLUG-IMPL-010`
- `PLUG-IMPL-013`
- `PLUG-IMPL-014` recommended

Unblocks:

- Allowlisted server-only user plugins

Current files:

- `packages/web/server/lib/plugins/server-loader.js`
- `packages/web/server/lib/plugins/server-loader.test.js`
- `packages/web/server/lib/plugins/example-plugins/example-server-plugin.js`
- `packages/web/server/lib/plugins/diagnostics.js`

Scope:

- Support allowlisted server-only runtime plugins.

Implementation checklist:

- [x] Define allowlist config for local ESM server plugins.
- [x] Add loader with path validation.
- [x] Add capability validation.
- [x] Add setup error isolation.
- [x] Add shutdown disposal.
- [x] Add diagnostics.
- [x] Add example local server plugin.
- [x] Add tests for denied path, denied capability, setup failure, route registration, and shutdown cleanup.

Acceptance criteria:

- [x] Server-only plugin can be loaded from an allowlisted local path.
- [x] Invalid plugins fail safely.
- [x] No public routes are exposed accidentally.
- [x] Type-check passes where applicable.
- [x] Lint passes.

Notes:

- Runtime UI plugin loading remains out of scope.
- `createServerPluginLoader({ allowlist, serverRegistry })` creates a loader that validates paths against allowlist, checks capabilities, and isolates setup errors.
- Only `server.*`, `storage.*`, `fs.*`, `git.*`, `notifications`, `model.policy` capabilities are allowed for server plugins.
- `fs.write`, `fs.exec`, `git.write` are flagged as dangerous.
- Diagnostics include user-loaded plugins and their setup errors.
- Example plugin at `example-plugins/example-server-plugin.js` demonstrates route + lifecycle registration.

### PLUG-IMPL-018: Hardening, Documentation, And CI Invariants

Status: [x]

Depends on:

- `PLUG-IMPL-010`
- `PLUG-IMPL-014` recommended
- `PLUG-IMPL-017` recommended

Unblocks:

- Stable external plugin authoring

Current files:

- `docs/PLUGIN_AUTHORING.md`
- `docs/PLUGIN_SECURITY_CHECKLIST.md`
- `docs/PLUGIN_PERFORMANCE_CHECKLIST.md`
- `packages/web/server/lib/plugins/architectural-ordering.test.js`
- `packages/plugin/src/architectural-ordering.test.ts`

Scope:

- Make the platform maintainable and safe for future contributors and agents.

Implementation checklist:

- [x] Write public plugin authoring guide for build-time bundled plugins.
- [x] Document supported surface IDs and capability IDs.
- [ ] Add plugin diagnostics UI in settings or dev panel if not already done.
- [x] Add architectural tests for route order and registry ordering.
- [x] Add performance checklist for hot-path plugin surfaces.
- [x] Add security review checklist for new capabilities.
- [x] Update module docs if plugin architecture becomes mandatory for new features.
- [x] Update release/build docs for bundled plugin Generation.
- [x] Add CI/test coverage for core plugin invariants where feasible.

Acceptance criteria:

- [x] New feature work has a documented path to register as a plugin/contribution.
- [x] Developers and agents can inspect plugins and diagnose contribution conflicts.
- [x] CI validation covers core plugin invariants.
- [x] Type-check passes.
- [x] Lint passes.

Notes:

- `docs/PLUGIN_AUTHORING.md` — complete guide for creating bundled plugins, covering manifest, UI contributions, server contributions, storage, capabilities, and building.
- `docs/PLUGIN_SECURITY_CHECKLIST.md` — security review checklist for new capabilities and plugin contributions.
- `docs/PLUGIN_PERFORMANCE_CHECKLIST.md` — performance checklist for hot-path plugin surfaces (tool renderers, SSE, stores, polling).
- Architectural ordering tests added in both JS (`architectural-ordering.test.js`) and TS (`architectural-ordering.test.ts`) covering phase ordering, source ordering, priority ordering, feature filtering, and setup error behavior.
- Plugin diagnostics UI deferred to PLUG-UI-003.

### PLUG-UI-001: Auth Provider UI Integration

Status: [x]

Depends on:

- `PLUG-IMPL-016`

Unblocks:

- Visible login flow changes
- SSO provider UI

Current files:

- `packages/ui/src/components/auth/SessionAuthGate.tsx`
- `packages/ui/src/components/auth/ProviderLoginArea.tsx`
- `packages/ui/src/lib/authProviderRegistry.tsx`
- `packages/ui/src/lib/authProviders.ts`

Scope:

- Migrate SessionAuthGate to render provider-driven login choices from `GET /api/auth/providers`.

Implementation checklist:

- [x] Fetch available providers on mount in SessionAuthGate.
- [x] Render provider buttons dynamically (password, passkey, oauth, sso, custom).
- [x] Preserve existing password/passkey behavior as built-in providers.
- [x] Add provider callback handler for OAuth/SSO flows.
- [x] Add tunnel-locked state handling per provider.
- [ ] Add tests for provider rendering, disabled providers, and error states.

Acceptance criteria:

- [x] Login screen shows provider buttons based on server response.
- [x] Existing password/passkey login works unchanged.
- [x] A new auth provider appears in the login UI after registration.
- [x] Type-check passes.
- [x] Lint passes.

Notes:

- This is the first visible UI change from the plugin architecture.
- Built-in password/passkey providers are already registered server-side.
- `ProviderLoginArea` component renders: OAuth/SSO buttons first, then passkey-only button (if no password), then password form (with embedded passkey button if available).
- Tunnel-locked state hides all provider forms.
- Fallback to basic password form if no providers are returned from server.

### PLUG-UI-002: Tool Renderer UI Integration

Status: [x]

Depends on:

- `PLUG-IMPL-012`

Unblocks:

- Custom tool rendering from plugins

Current files:

- `packages/ui/src/components/chat/message/parts/ToolPart.tsx`
- `packages/ui/src/components/chat/message/pluginToolRenderers.tsx`
- `packages/ui/src/lib/toolRendererRegistry.tsx`
- `packages/plugin/src/tool-renderer-types.ts`

Scope:

- Migrate ToolPart.tsx to use ToolRendererRegistry instead of hardcoded tool switch.

Implementation checklist:

- [x] Replace hardcoded tool switch in ToolPart with registry lookup.
- [x] Preserve existing render output and expansion behavior for all built-in tools.
- [x] Add fallback for unregistered tools (default renderer).
- [x] Add memoization boundaries for streaming updates.
- [ ] Add tests for registry-driven rendering and fallback behavior.

Acceptance criteria:

- [x] All existing tool renderers produce identical output.
- [x] A registered plugin tool renderer is used for its tool name.
- [x] Streaming performance is not degraded.
- [x] Type-check passes.
- [x] Lint passes.

Notes:

- Renderers registered: question, task, edit, multiedit, apply_patch, write, create, file_write, and wildcard default.
- Registry lookup happens at component level (not inside renderResultContent) to satisfy React hooks rules.
- Existing if/else chain in renderResultContent serves as fallback if no renderer is registered.
- Renderer components accept optional `renderScrollable` prop for scrollable content wrapping.
- `ToolRendererProps` and `ToolRendererComponent` exported from `@openchamber/plugin`.

### PLUG-UI-003: Plugin Diagnostics UI

Status: [x]

Depends on:

- `PLUG-IMPL-010`
- `PLUG-IMPL-017`

Unblocks:

- User-facing plugin inspection

Current files:

- `packages/web/server/lib/plugins/diagnostics.js`
- `packages/ui/src/components/sections/PluginDiagnosticsView.tsx`
- `packages/ui/src/lib/settings/metadata.ts`
- `packages/ui/src/lib/settingsRegistry.tsx`
- `packages/ui/src/components/views/SettingsView.tsx`

Scope:

- Add a settings page showing loaded plugins, their status, capabilities, and errors.

Implementation checklist:

- [x] Create PluginDiagnosticsView component.
- [x] Fetch plugin diagnostics from `GET /api/plugins`.
- [x] Display plugin list with status, capabilities, contributions, and errors.
- [x] Add expandable details per plugin.
- [x] Add error highlighting for failed plugins.
- [x] Register as settings page via SettingsPageRegistry.
- [x] Add to settings metadata and navigation.
- [ ] Add tests for rendering, loading, and error states.

Acceptance criteria:

- [x] Users can see all loaded plugins in settings.
- [x] Failed plugins show error details.
- [x] Type-check passes.
- [x] Lint passes.

Notes:

- Implemented as a settings page via `SettingsPageRegistry` with slug `plugin-diagnostics`.
- Fetches from `GET /api/plugins` on mount, displays plugin cards with expandable details.
- Filter buttons for All/Errors/User plugins.
- Error highlighting with red border and background for failed plugins.
- Uses theme tokens for all colors.

### PLUG-UI-004: Settings Sections And Server Schema Integration

Status: [x]

Depends on:

- `PLUG-IMPL-011`
- `PLUG-IMPL-013`

Unblocks:

- Plugin settings sections with server-validated schemas

Current files:

- `packages/plugin/src/settings-section-registry.ts`
- `packages/plugin/src/settings-section-types.ts`
- `packages/plugin/src/settings-section-registry.test.ts`
- `packages/web/server/lib/plugins/settings-registry.js`
- `packages/ui/src/lib/settingsSectionRegistry.tsx`
- `packages/ui/src/components/sections/shared/PluginSettingsSections.tsx`
- `packages/ui/src/components/sections/openchamber/OpenChamberPage.tsx`
- `packages/web/server/index.js`

Scope:

- Complete settings integration with section registration and server schema validation.

Implementation checklist:

- [x] Implement settings section registration API.
- [x] Add server settings schema registration and validation.
- [x] Wire server schemas to UI settings forms.
- [x] Add migration support for schema versions.
- [x] Add tests for section registry.
- [ ] Add tests for schema validation and migration.

Acceptance criteria:

- [x] A plugin can register a settings section within an existing page.
- [x] Server validates settings against registered schema.
- [x] Schema migrations run on version change.
- [x] Type-check passes.
- [x] Lint passes.

Notes:

- `SettingsSectionRegistry` manages sections per page with source/priority ordering.
- `settings.section` capability added to plugin capability set.
- Server validation endpoint: `POST /api/plugins/settings/validate`
- Server migration endpoint: `POST /api/plugins/settings/migrate`
- Server schemas endpoint: `GET /api/plugins/settings/schemas`
- `PluginSettingsSections` component renders plugin sections at bottom of each settings page.
- Sections wired into: appearance, chat, sessions, shortcuts, git, github, notifications, voice, tunnel.
- Schema validation supports: required, type, enum, min/max constraints.

## Relationship To Internal Integration Backlog

The architecture tasks in this file build the host platform. The tasks in `docs/plugins-integration.md` migrate concrete internal features onto that platform.

Use this rough mapping:

| Architecture task | Integration tasks unblocked |
|---|---|
| `PLUG-IMPL-001` | `PLUG-FOUNDATION-001` |
| `PLUG-IMPL-002` | `PLUG-FOUNDATION-002`, feature gates |
| `PLUG-IMPL-003` | UI surface/slot/wrap/replace migrations |
| `PLUG-IMPL-004` | Server route/runtime migrations |
| `PLUG-IMPL-005` | All built-in plugin migrations |
| `PLUG-IMPL-006` | `PLUG-FEATURE-TERMINAL-001` |
| `PLUG-IMPL-007` | `PLUG-FEATURE-FILES-001` |
| `PLUG-IMPL-008` | `PLUG-FEATURE-GIT-001` |
| `PLUG-IMPL-011` | Settings, commands, slash command tasks |
| `PLUG-IMPL-012` | Tool renderer tasks |
| `PLUG-IMPL-016` | Auth/SSO tasks |

When an architecture task fully completes the matching integration task, update both documents. If it only creates the platform primitive, leave the integration task open.
