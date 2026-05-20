# Internal Plugin Integration Backlog

Status: migration backlog draft

References:

- Architecture: `docs/plugins-architecture.md`

## Purpose

This document is the working backlog for migrating existing OpenChamber internal capabilities onto the plugin architecture after the host architecture primitives exist. It is intended for agents and maintainers executing internal feature migrations incrementally.

Each task represents a complete migration unit for one internal capability, product surface, or built-in feature. Agents should update task status as work progresses and add notes when blockers or follow-up work are discovered.

## Status Legend

- `[ ]` Not started
- `[~]` In progress
- `[x]` Completed
- `[!]` Blocked
- `[-]` Cancelled or superseded

## Migration Rules

- Read `docs/plugins-architecture.md` before starting any task in this backlog.
- This backlog assumes the plugin host architecture primitives already exist. Do not implement missing architecture primitives here; if a primitive is missing, mark the task blocked and report the missing primitive.
- Prefer registering existing code as built-in plugin contributions before physically moving files.
- Do not expose raw Zustand stores to plugins.
- Do not expose raw `RuntimeAPIs`, Electron IPC, VS Code APIs, or mutable `opencodeClient` to plugins.
- Preserve server-side validation and safety gates.
- Preserve lazy-loading boundaries for heavy UI surfaces.
- Preserve cross-runtime parity or explicitly document runtime differences.
- Add tests for disabled-feature behavior, persisted ID fallback, route ordering, and diagnostics where relevant.
- Run `bun run type-check` and `bun run lint` before completing implementation work.

## Task Template

Use this structure for new migration tasks:

```md
### TASK-ID: Task Name

Status: [ ]

Depends on:

- PHASE or task ID

Current files:

- `path/to/file`

Target plugin:

- `openchamber.plugin.example`

Contribution IDs:

- `example.surface`

Scope:

- What changes.

Implementation checklist:

- [ ] Step.

Acceptance criteria:

- [ ] Behavior.

Notes:

- Runtime/security/performance notes.
```

## Workbench And Layout Tasks

### PLUG-WORKBENCH-001: Main Workbench Surface Registry

Status: [ ]

Depends on:

- Plugin UI contribution runtime is available.

Current files:

- `packages/ui/src/components/layout/MainLayout.tsx`
- `packages/ui/src/stores/useUIStore.ts`

Target plugin:

- `openchamber.plugin.core-workbench`

Contribution IDs:

- `workbench.main`
- `workbench.main.tabs`

Scope:

- Replace hardcoded main-tab switch with registered surfaces.

Implementation checklist:

- [ ] Add main surface registry lookup.
- [ ] Add fallback to chat/default surface when active surface is missing.
- [ ] Keep lazy loading for heavy views.
- [ ] Migrate persisted `activeMainTab` safely.
- [ ] Keep current layout behavior unchanged for enabled built-ins.

Acceptance criteria:

- [ ] Main views render from registry.
- [ ] Unknown persisted active tab falls back safely.
- [ ] Mobile and desktop behavior remain correct.

Notes:

- This should be done after at least one simple migrated surface works.

### PLUG-WORKBENCH-002: Right Panel Surface Registry

Status: [ ]

Depends on:

- Plugin UI contribution runtime is available.

Current files:

- `packages/ui/src/components/layout/RightSidebar.tsx`
- `packages/ui/src/components/layout/RightSidebarTabs.tsx`
- `packages/ui/src/components/layout/MainLayout.tsx`
- `packages/ui/src/stores/useUIStore.ts`

Target plugin:

- `openchamber.plugin.core-workbench`

Contribution IDs:

- `workbench.right-panel`
- `workbench.right-panel.tabs`

Scope:

- Replace hardcoded right sidebar tabs with registered surfaces and support full right-panel replacement.

Implementation checklist:

- [ ] Add right-panel surface registry.
- [ ] Add right-panel replacement target.
- [ ] Add persisted right-panel tab fallback.
- [ ] Unify mobile right drawer with the registered right-panel content if feasible.
- [ ] Preserve resize, drag-region, safe area, and open/close behavior.

Acceptance criteria:

- [ ] Git/files/context panels can be registry-driven.
- [ ] Full right-panel content replacement is supported by `replace`.
- [ ] Missing active right-panel surface falls back safely.

Notes:

- Host should own the shell unless an explicit shell replacement target is added later.

### PLUG-WORKBENCH-003: Bottom Dock Generalization

Status: [x]

Depends on:

- Plugin UI contribution runtime is available.

Current files:

- `packages/ui/src/components/layout/BottomTerminalDock.tsx`
- `packages/ui/src/components/layout/MainLayout.tsx`
- `packages/ui/src/stores/useUIStore.ts`

Target plugin:

- `openchamber.plugin.core-workbench`
- `openchamber.plugin.terminal`

Contribution IDs:

- `workbench.bottom-dock`

Scope:

- Turn terminal-specific bottom dock into a generic dock that can mount registered surfaces.

Implementation checklist:

- [x] Add bottom dock surface placement.
- [x] Preserve current terminal open/fullscreen state.
- [x] Add fallback if active bottom surface is disabled.
- [x] Keep mobile behavior unchanged.

Acceptance criteria:

- [x] Terminal can render through bottom dock surface placement.
- [x] Future surfaces can target bottom dock without terminal-specific code.

Notes:

- Created `BottomDockRegistry` in `packages/plugin/src/bottom-dock-registry.ts` with types in `bottom-dock-types.ts`.
- Created UI bridge in `packages/ui/src/lib/bottomDockRegistry.tsx` that registers terminal as the default core surface.
- Updated `MainLayout.tsx` to use `renderBottomDockSurface("terminal")` instead of hardcoded `TerminalView`.
- `BottomTerminalDock` component remains unchanged (already generic via `children` prop).
- 9 tests added for registry behavior (registration, sorting, filtering, fallback, sanitization).

### PLUG-WORKBENCH-004: Context Panel Renderer Registry

Status: [ ]

Depends on:

- Plugin UI contribution runtime is available.

Current files:

- `packages/ui/src/components/layout/ContextPanel.tsx`
- `packages/ui/src/components/layout/ContextSidebarTab.tsx`
- `packages/ui/src/stores/useUIStore.ts`

Target plugin:

- `openchamber.plugin.core-workbench`
- `openchamber.plugin.files`
- `openchamber.plugin.diff`
- `openchamber.plugin.plan`
- `openchamber.plugin.chat`
- `openchamber.plugin.preview`

Contribution IDs:

- `workbench.context-panel`
- `workbench.context-panel.renderer.file`
- `workbench.context-panel.renderer.diff`
- `workbench.context-panel.renderer.plan`
- `workbench.context-panel.renderer.chat`
- `workbench.context-panel.renderer.preview`
- `workbench.context-panel.renderer.browser`

Scope:

- Replace closed `ContextPanelMode` rendering with renderer registry.

Implementation checklist:

- [ ] Add context renderer registry.
- [ ] Add persistence sanitizer for unknown renderer IDs.
- [ ] Migrate built-in context modes as internal renderers.
- [ ] Preserve tab clamping/dedupe behavior.

Acceptance criteria:

- [ ] Existing context panel modes work.
- [ ] Unknown plugin modes are dropped or shown as unavailable safely.

Notes:

- This touches persisted UI state; migration must be careful.

## Vertical Slice Feature Tasks

### PLUG-FEATURE-TERMINAL-001: Terminal Built-In Plugin

Status: [x]

Depends on:

- Plugin built-in loader is available.
- PLUG-WORKBENCH-001
- PLUG-WORKBENCH-003

Current files:

- `packages/ui/src/components/views/TerminalView.tsx`
- `packages/ui/src/components/terminal/*`
- `packages/ui/src/stores/useTerminalStore.ts`
- `packages/web/server/lib/terminal/runtime.js`
- `packages/web/src/api/terminal.ts`
- `packages/web/server/lib/plugins/builtins/terminal.js`
- `packages/web/server/lib/opencode/startup-pipeline-runtime.js`

Target plugin:

- `openchamber.plugin.terminal`

Contribution IDs:

- `terminal.surface`
- `workbench.main.surface.terminal`
- `workbench.bottom-dock.surface.terminal`
- `server.terminal.pty`

Scope:

- Migrate terminal UI and server runtime into a built-in plugin contribution.

Implementation checklist:

- [x] Register terminal main surface.
- [x] Register terminal bottom dock surface.
- [x] Register terminal server routes/runtime.
- [x] Gate terminal by `openchamber.feature.terminal`.
- [x] Keep VS Code terminal unavailable/stub behavior explicit.
- [x] Add disabled UI and disabled route tests.

Acceptance criteria:

- [x] Terminal works exactly as before when enabled.
- [x] Disabled terminal removes UI and route access.
- [x] Diagnostics show terminal contributions.

Notes:

- Terminal runtime is created in `startup-pipeline-runtime.js` only if `openchamber.feature.terminal` is enabled.
- Routes are registered via `TERMINAL_SERVER_PLUGIN` in `builtins/terminal.js` with `featureId` gating.
- UI bottom dock surface registered in `bottomDockRegistry.tsx` with `featureId: "openchamber.feature.terminal"`.
- Graceful shutdown handles null terminalRuntime when feature is disabled.
- `terminalFeatureEnabled` flag exposed via startup pipeline result and graceful shutdown runtime.

### PLUG-FEATURE-FILES-001: Files Built-In Plugin

Status: [ ]

Depends on:

- Plugin built-in loader is available.
- PLUG-WORKBENCH-001
- PLUG-WORKBENCH-002

Current files:

- `packages/ui/src/components/views/FilesView.tsx`
- `packages/ui/src/components/layout/SidebarFilesTree.tsx`
- `packages/ui/src/stores/useFilesViewTabsStore.ts`
- `packages/ui/src/stores/fileStore.ts`
- `packages/web/server/lib/fs/routes.js`
- `packages/web/server/lib/fs/search.js`
- `packages/web/src/api/files.ts`

Target plugin:

- `openchamber.plugin.files`

Contribution IDs:

- `files.view`
- `files.tree`
- `files.editor.renderer.text`
- `server.fs.core`

Scope:

- Migrate files main surface, sidebar files tree, and server FS routes.

Implementation checklist:

- [ ] Register files main surface.
- [ ] Register right-panel files surface.
- [ ] Register FS server routes.
- [ ] Gate by `openchamber.feature.files`.
- [ ] Add persisted tab fallback for disabled/missing files surface.
- [ ] Preserve VS Code file bridge behavior.

Acceptance criteria:

- [ ] Files view and sidebar tree behave as before when enabled.
- [ ] Disabled files hides UI and rejects/hides routes according to policy.
- [ ] Diagnostics show files contributions.

Notes:

- Files writes/deletes/renames are high-risk capabilities.

### PLUG-FEATURE-GIT-001: Git Built-In Plugin

Status: [ ]

Depends on:

- Plugin built-in loader is available.
- PLUG-WORKBENCH-001
- PLUG-WORKBENCH-002
- PLUG-COMMANDS-001 if command contributions are included
- PLUG-SETTINGS-001 if settings contributions are included

Current files:

- `packages/ui/src/components/views/GitView.tsx`
- `packages/ui/src/components/views/git/*`
- `packages/ui/src/stores/useGitStore.ts`
- `packages/ui/src/stores/useGitIdentitiesStore.ts`
- `packages/ui/src/stores/useGitHubAuthStore.ts`
- `packages/web/server/lib/git/routes.js`
- `packages/web/server/lib/git/service.js`
- `packages/web/src/api/git.ts`

Target plugin:

- `openchamber.plugin.git`

Contribution IDs:

- `git.view`
- `git.status`
- `git.view.sections`
- `server.git.core`

Scope:

- Migrate Git UI surfaces and server routes.

Implementation checklist:

- [ ] Register Git main surface.
- [ ] Register Git right-panel surface.
- [ ] Register Git server routes.
- [ ] Gate by `openchamber.feature.git`.
- [ ] Move right-sidebar Git polling into plugin activation or preserve equivalent behavior.
- [ ] Add disabled UI and route tests.
- [ ] Preserve worktree repair behavior.

Acceptance criteria:

- [ ] Git behavior is unchanged when enabled.
- [ ] Disabled Git removes UI and rejects/hides Git routes.
- [ ] Diagnostics show Git contributions.

Notes:

- Git writes and identity handling are high-risk.

### PLUG-FEATURE-GITHUB-001: GitHub Built-In Plugin

Status: [ ]

Depends on:

- PLUG-FEATURE-GIT-001
- PLUG-AUTH-001 if provider auth registry exists

Current files:

- `packages/ui/src/stores/useGitHubAuthStore.ts`
- `packages/ui/src/stores/useGitHubPrStatusStore.ts`
- `packages/ui/src/components/session/GitHubIntegrationDialog.tsx`
- `packages/ui/src/components/session/GitHubIssuePickerDialog.tsx`
- `packages/ui/src/components/session/GitHubPrPickerDialog.tsx`
- `packages/ui/src/components/views/git/PullRequestSection.tsx`
- `packages/web/server/lib/github/routes.js`
- `packages/web/src/api/github.ts`

Target plugin:

- `openchamber.plugin.github`

Contribution IDs:

- `github.oauth`
- `github.prs`
- `github.issues`
- `git.pullRequest.section`

Scope:

- Migrate GitHub OAuth, PR/issue routes, and GitHub UI affordances.

Implementation checklist:

- [ ] Register GitHub server routes.
- [ ] Register GitHub auth/status UI surfaces.
- [ ] Register PR section contribution into Git view.
- [ ] Register issue/PR picker actions.
- [ ] Gate by `openchamber.feature.github`.
- [ ] Preserve VS Code partial/disabled backend behavior.

Acceptance criteria:

- [ ] GitHub behavior is unchanged where supported.
- [ ] VS Code limitations are explicit.
- [ ] Disabled GitHub removes PR/issue UI and routes.

Notes:

- Keep OAuth/token storage host-owned and redacted.

### PLUG-FEATURE-CHAT-001: Chat Built-In Plugin

Status: [ ]

Depends on:

- PLUG-WORKBENCH-001
- PLUG-TOOLS-001 for tool renderers if included

Current files:

- `packages/ui/src/components/views/ChatView.tsx`
- `packages/ui/src/components/chat/*`
- `packages/ui/src/sync/*`
- `packages/ui/src/stores/messageQueueStore.ts`
- `packages/ui/src/stores/permissionStore.ts`

Target plugin:

- `openchamber.plugin.chat`

Contribution IDs:

- `chat.surface`
- `chat.input`
- `chat.timeline`
- `chat.message`

Scope:

- Register chat as a core surface and expose chat slots.

Implementation checklist:

- [ ] Register chat main surface.
- [ ] Add chat slots: before viewport, after viewport, input toolbar, message actions.
- [ ] Preserve embedded session chat mode.
- [ ] Preserve mini-chat mode or document separate migration.
- [ ] Add hot-path performance guardrails.

Acceptance criteria:

- [ ] Chat remains default/fallback surface.
- [ ] Plugin slot in message actions can render without breaking memoization.

Notes:

- This is the highest performance-risk UI area.

### PLUG-FEATURE-DIFF-001: Diff Built-In Plugin

Status: [ ]

Depends on:

- PLUG-WORKBENCH-001
- PLUG-WORKBENCH-004 if context diff renderer included

Current files:

- `packages/ui/src/components/views/DiffView.tsx`
- `packages/ui/src/components/views/PierreDiffViewer.tsx`
- `packages/ui/src/components/comments/*`

Target plugin:

- `openchamber.plugin.diff`

Contribution IDs:

- `diff.view`
- `diff.viewer`
- `workbench.context-panel.renderer.diff`

Scope:

- Register diff view and context diff renderer.

Implementation checklist:

- [ ] Register diff main surface.
- [ ] Register diff context renderer.
- [ ] Preserve inline comment behavior.
- [ ] Add fallback for disabled/missing diff plugin.

Acceptance criteria:

- [ ] Diff view behavior is unchanged when enabled.
- [ ] Context panel diff tabs render through registry.

Notes:

- Scroll/comment logic is sensitive.

### PLUG-FEATURE-PLAN-001: Plan Built-In Plugin

Status: [ ]

Depends on:

- Plugin feature registry is available.
- PLUG-WORKBENCH-001

Current files:

- `packages/ui/src/components/views/PlanView.tsx`
- `packages/ui/src/hooks/usePlanDetection.ts`
- `packages/ui/src/stores/useFeatureFlagsStore.ts`
- Chat message normalization paths for plan synthetic text.

Target plugin:

- `openchamber.plugin.plan`

Contribution IDs:

- `plan.view`
- `workbench.context-panel.renderer.plan`
- `openchamber.feature.plan-mode`

Scope:

- Move plan mode from one-off feature flag to plugin-owned feature/surface.

Implementation checklist:

- [ ] Register plan main surface.
- [ ] Register plan context renderer if applicable.
- [ ] Keep plan mode server health/feature hydration behavior.
- [ ] Preserve plan detection logic.
- [ ] Add disabled feature tests.

Acceptance criteria:

- [ ] Existing plan mode behavior is unchanged.
- [ ] Disabled plan mode hides plan UI and stops plan-specific detection.

Notes:

- Plan mode currently influences chat synthetic message display.

## Settings And Commands Tasks

### PLUG-SETTINGS-001: Settings Page Registry

Status: [ ]

Depends on:

- Plugin UI contribution runtime is available.
- Plugin server settings-schema support is available.

Current files:

- `packages/ui/src/components/views/SettingsView.tsx`
- `packages/ui/src/components/views/SettingsWindow.tsx`
- `packages/ui/src/lib/settings/metadata.ts`
- `packages/ui/src/components/sections/**`

Target plugin:

- `openchamber.plugin.settings`

Contribution IDs:

- `settings.pages`
- `settings.nav.groups`
- `settings.sections`

Scope:

- Move settings IA and page rendering to registry.

Implementation checklist:

- [ ] Add settings page registration API.
- [ ] Add settings section registration API.
- [ ] Migrate metadata to registered pages.
- [ ] Add runtime availability filtering.
- [ ] Add persisted settings page fallback.
- [ ] Add lazy page rendering.

Acceptance criteria:

- [ ] Existing settings pages render as before.
- [ ] Missing plugin page ID falls back safely.
- [ ] Plugin can add a settings page/section.

Notes:

- Settings validation must remain server-side for durable settings.

### PLUG-COMMANDS-001: Command Palette And Global Commands Registry

Status: [ ]

Depends on:

- Plugin UI contribution runtime is available.

Current files:

- `packages/ui/src/components/ui/CommandPalette.tsx`
- `packages/ui/src/hooks/useMenuActions.ts`
- `packages/ui/src/lib/shortcuts.ts`
- `packages/ui/src/stores/useUIStore.ts`

Target plugin:

- `openchamber.plugin.command-palette`

Contribution IDs:

- `commands.global`
- `command-palette.actions`
- `command-palette.groups`
- `commands.native-menu`

Scope:

- Unify command palette, shortcuts, and native menu action registration.

Implementation checklist:

- [ ] Add command registration API.
- [ ] Add command palette group/search provider API.
- [ ] Migrate built-in palette actions.
- [ ] Migrate native menu action handling to command IDs where feasible.
- [ ] Add shortcut registration/override handling.
- [ ] Add lazy/cancellable search provider contract.

Acceptance criteria:

- [ ] Existing command palette behavior is unchanged.
- [ ] Plugin command can appear in palette.
- [ ] Native menu can dispatch registered command where applicable.

Notes:

- Command palette can become performance-sensitive with plugin search providers.

### PLUG-SLASH-COMMANDS-001: Slash Command Registry

Status: [ ]

Depends on:

- PLUG-COMMANDS-001

Current files:

- `packages/ui/src/components/chat/CommandAutocomplete.tsx`
- `packages/ui/src/stores/useCommandsStore.ts`
- `packages/ui/src/components/sections/commands/**`

Target plugin:

- `openchamber.plugin.commands`

Contribution IDs:

- `chat.commands.registry`
- `chat.commands.autocomplete.items`

Scope:

- Move slash command built-ins and autocomplete behavior to command registry.

Implementation checklist:

- [ ] Register built-in slash commands.
- [ ] Remove duplicated built-in fallback lists.
- [ ] Preserve OpenCode command loading.
- [ ] Add source metadata instead of name-only built-in detection.

Acceptance criteria:

- [ ] Slash command autocomplete behaves as before.
- [ ] Plugin slash command can be contributed.

Notes:

- Do not bypass OpenCode slash-command semantics accidentally.

## Tool And Model Tasks

### PLUG-TOOLS-001: Tool Renderer Registry

Status: [ ]

Depends on:

- Plugin UI contribution runtime is available.

Current files:

- `packages/ui/src/components/chat/message/parts/ToolPart.tsx`
- `packages/ui/src/components/chat/message/toolRenderers.tsx`
- `packages/ui/src/components/chat/message/parts/toolPresentation.tsx`
- `packages/ui/src/components/chat/message/parts/toolRenderUtils.ts`
- `packages/ui/src/lib/toolHelpers.ts`

Target plugin:

- `openchamber.plugin.tools`

Contribution IDs:

- `chat.tool.renderer.*`
- `chat.tool.icon.*`
- `chat.tool.classifier`
- `chat.tool.side-effect-hints`

Scope:

- Move tool presentation and renderer logic to registry.

Implementation checklist:

- [ ] Add exact tool renderer lookup.
- [ ] Add wildcard/prefix renderer lookup.
- [ ] Add tool icon metadata registry.
- [ ] Add expandable/static/standalone classifier registry.
- [ ] Add side-effect hint registry for file/Git mutations.
- [ ] Migrate built-in tools.
- [ ] Add memoization and hot-path tests.

Acceptance criteria:

- [ ] Existing tool rendering is unchanged.
- [ ] Custom test tool renderer works.
- [ ] Streaming performance is not degraded.

Notes:

- This is one of the highest hot-path risk tasks.

### PLUG-MODELS-001: Model Policy And Picker Registry

Status: [ ]

Depends on:

- Plugin UI contribution runtime is available.

Current files:

- `packages/ui/src/stores/useConfigStore.ts`
- `packages/ui/src/hooks/useModelLists.ts`
- `packages/ui/src/sync/selection-store.ts`
- model picker/selector components.

Target plugin:

- `openchamber.plugin.models`

Contribution IDs:

- `models.registry`
- `models.picker`
- `models.filters`
- `models.decorators`
- `models.ranking`

Scope:

- Expose model filter/decorator/ranking APIs without plugins mutating provider/model stores directly.

Implementation checklist:

- [ ] Add indexed model list facade.
- [ ] Add model filter registry.
- [ ] Add model decoration registry.
- [ ] Add model ranking registry.
- [ ] Add plugin contribution performance limits.
- [ ] Preserve favorites/recents/hidden models.

Acceptance criteria:

- [ ] Existing model picker behavior is unchanged.
- [ ] Plugin can hide/decorate models through host policy.

Notes:

- Avoid nested provider/model scans per render.

## Auth And Runtime Tasks

### PLUG-AUTH-001: Auth Provider Registry

Status: [ ]

Depends on:

- Plugin server contribution runtime is available.
- Plugin auth provider support is available.

Current files:

- `packages/web/server/lib/ui-auth/ui-auth.js`
- `packages/web/server/lib/opencode/core-routes.js`
- `packages/web/server/lib/opencode/tunnel-auth.js`
- `packages/ui/src/components/auth/SessionAuthGate.tsx`

Target plugin:

- `openchamber.plugin.auth-core`

Contribution IDs:

- `auth.ui-password`
- `auth.passkey`
- `auth.tunnel-session`
- `auth.provider.*`

Scope:

- Refactor existing auth flows into provider-like architecture and prepare for SSO.

Implementation checklist:

- [ ] Define auth provider contract.
- [ ] Expose provider discovery/status endpoint.
- [ ] Refactor password/passkey as internal providers or adapters.
- [ ] Refactor tunnel auth interaction carefully.
- [ ] Update `SessionAuthGate` to use provider data.
- [ ] Add fake auth provider for tests.
- [ ] Add security tests.

Acceptance criteria:

- [ ] Existing auth behavior is unchanged.
- [ ] Fake provider can add a login option.
- [ ] Auth enforcement remains server-side.

Notes:

- SSO should not own host session storage directly.

## Remaining Feature Backlog

### PLUG-FEATURE-SESSIONS-001: Sessions Sidebar Plugin

Status: [ ]

Depends on:

- PLUG-WORKBENCH-002

Current files:

- `packages/ui/src/components/session/SessionSidebar.tsx`
- `packages/ui/src/components/session/sidebar/*`
- session stores and sync state.

Target plugin:

- `openchamber.plugin.sessions`

Contribution IDs:

- `workbench.left-sidebar`
- `sessions.sidebar.header`
- `sessions.sidebar.footer`
- `sessions.row.actions`
- `sessions.row.badges`

Scope:

- Make the current full left sidebar a built-in plugin replacement/contribution while preserving host shell.

Implementation checklist:

- [ ] Register current session sidebar as default left-sidebar content.
- [ ] Add slots for header/footer/row actions/badges.
- [ ] Preserve mobile drawer variant.
- [ ] Preserve row memoization.

Acceptance criteria:

- [ ] Existing sidebar behavior is unchanged.
- [ ] Plugin can add a row badge/action without broad rerenders.

Notes:

- High performance risk due session list updates.

### PLUG-FEATURE-PROJECTS-001: Projects And Worktrees Plugin

Status: [ ]

Depends on:

- PLUG-FEATURE-SESSIONS-001
- PLUG-SETTINGS-001

Current files:

- `packages/ui/src/stores/useProjectsStore.ts`
- `packages/ui/src/components/session/*Project*`
- project settings sections.
- `packages/web/server/lib/projects/*`

Target plugin:

- `openchamber.plugin.projects`

Contribution IDs:

- `projects.registry`
- `settings.projects`
- `sessions.project-list`

Scope:

- Register project/worktree settings and sidebar contributions.

Implementation checklist:

- [ ] Add project facade.
- [ ] Register project settings pages.
- [ ] Register project sidebar/list contributions.
- [ ] Preserve directory switching rules.

Acceptance criteria:

- [ ] Project behavior is unchanged.
- [ ] Plugin API avoids cached directory closures.

Notes:

- Directory context rules are strict: read current directory dynamically.

### PLUG-FEATURE-MCP-001: MCP Plugin

Status: [ ]

Depends on:

- PLUG-SETTINGS-001
- PLUG-AUTH-001 if OAuth callback integration is included

Current files:

- `packages/ui/src/stores/useMcpStore.ts`
- `packages/ui/src/stores/useMcpConfigStore.ts`
- `packages/ui/src/components/sections/mcp/**`
- `packages/web/server/lib/opencode/mcp.js`
- MCP config routes.

Target plugin:

- `openchamber.plugin.mcp`

Contribution IDs:

- `mcp.runtime`
- `mcp.config`
- `mcp.auth`
- `settings.mcp`

Scope:

- Migrate MCP settings/runtime/auth surfaces.

Implementation checklist:

- [ ] Register MCP settings page.
- [ ] Register MCP config server routes if route registry is ready.
- [ ] Register header/services menu contribution if available.
- [ ] Preserve OAuth callback path behavior.

Acceptance criteria:

- [ ] MCP behavior is unchanged.
- [ ] Secrets/headers remain redacted.

Notes:

- Runtime status and config stores are separate; keep selectors narrow.

### PLUG-FEATURE-SKILLS-001: Skills Plugin

Status: [ ]

Depends on:

- PLUG-SETTINGS-001
- PLUG-SLASH-COMMANDS-001 if skill command integration is included

Current files:

- `packages/ui/src/stores/useSkillsStore.ts`
- `packages/ui/src/stores/useSkillsCatalogStore.ts`
- `packages/ui/src/components/sections/skills/**`
- `packages/ui/src/components/chat/SkillAutocomplete.tsx`
- `packages/web/server/lib/opencode/skill-routes.js`
- `packages/web/server/lib/skills-catalog/*`

Target plugin:

- `openchamber.plugin.skills`

Contribution IDs:

- `skills.installed`
- `skills.catalog`
- `chat.autocomplete.provider.skill`
- `settings.skills.*`

Scope:

- Migrate installed skills, catalog, autocomplete, and skill routes.

Implementation checklist:

- [ ] Register skills settings pages.
- [ ] Register skill autocomplete provider.
- [ ] Register skills server routes.
- [ ] Preserve install/supporting file safety.

Acceptance criteria:

- [ ] Skills behavior is unchanged.
- [ ] Skill install partial-failure behavior remains explicit.

Notes:

- Supporting file writes are sensitive.

### PLUG-FEATURE-AGENTS-001: Agents Plugin

Status: [ ]

Depends on:

- PLUG-SETTINGS-001

Current files:

- `packages/ui/src/stores/useAgentsStore.ts`
- `packages/ui/src/stores/useAgentGroupsStore.ts`
- `packages/ui/src/components/views/agent-manager/*`
- agent settings sections.
- agent config routes.

Target plugin:

- `openchamber.plugin.agents`

Contribution IDs:

- `agents.registry`
- `agents.config`
- `vscode.agent-manager.view`
- `settings.agents`

Scope:

- Migrate agent settings and VS Code agent manager surface.

Implementation checklist:

- [ ] Register agents settings page.
- [ ] Register VS Code agent manager surface.
- [ ] Register agent config server routes if route registry is ready.
- [ ] Preserve TTL/in-flight dedupe loading.

Acceptance criteria:

- [ ] Agent settings behavior is unchanged.
- [ ] VS Code agent manager still works.

Notes:

- Normalize built-in/native/hidden agent metadata.

### PLUG-FEATURE-NOTIFICATIONS-001: Notifications Plugin

Status: [ ]

Depends on:

- PLUG-SETTINGS-001
- Plugin server contribution runtime is available.

Current files:

- `packages/ui/src/stores/useUIStore.ts` notification preferences
- notification settings components
- `packages/web/server/lib/notifications/*`
- `packages/web/src/api/notifications.ts`
- `packages/web/src/api/push.ts`

Target plugin:

- `openchamber.plugin.notifications`

Contribution IDs:

- `notifications.core`
- `notifications.push`
- `settings.notifications`

Scope:

- Migrate notification routes, settings, push, templates, and session attention integration.

Implementation checklist:

- [ ] Register notification settings sections.
- [ ] Register notification routes/runtime.
- [ ] Register push routes/runtime.
- [ ] Preserve desktop notification callback behavior.
- [ ] Preserve session attention snapshot behavior.

Acceptance criteria:

- [ ] Notifications behave as before.
- [ ] Disabled notifications stop notification routes/effects as defined by policy.

Notes:

- Notification event pipeline should not block SSE/session hot paths.

### PLUG-FEATURE-VOICE-001: Voice Plugin

Status: [ ]

Depends on:

- PLUG-SETTINGS-001

Current files:

- `packages/ui/src/components/voice/*`
- `packages/ui/src/lib/voice/*`
- voice settings sections
- `packages/web/server/lib/tts/*`

Target plugin:

- `openchamber.plugin.voice`

Contribution IDs:

- `voice.provider`
- `chat.input.voice-button`
- `settings.voice`
- `server.tts`
- `server.stt`

Scope:

- Migrate voice provider, browser voice button, TTS/STT settings, and server routes.

Implementation checklist:

- [ ] Register voice app provider/effects.
- [ ] Register chat input voice button slot.
- [ ] Register voice settings page/section.
- [ ] Register TTS/STT server routes.
- [ ] Migrate scattered localStorage keys into plugin/host storage.

Acceptance criteria:

- [ ] Voice behavior is unchanged.
- [ ] Sensitive keys are not exposed generically.

Notes:

- Existing voice config has scattered storage; migration should precede public API.

### PLUG-FEATURE-SCHEDULED-TASKS-001: Scheduled Tasks Plugin

Status: [ ]

Depends on:

- Plugin server contribution runtime is available.
- PLUG-COMMANDS-001 if command actions are included

Current files:

- `packages/ui/src/components/session/ScheduledTasksDialog.tsx`
- `packages/ui/src/components/session/ScheduledTaskEditorDialog.tsx`
- `packages/web/server/lib/scheduled-tasks/*`

Target plugin:

- `openchamber.plugin.scheduled-tasks`

Contribution IDs:

- `scheduled-tasks.runtime`
- `scheduled-tasks.routes`
- `sessions.header.actions.scheduled-tasks`

Scope:

- Migrate scheduled task runtime, routes, dialogs, and session/sidebar actions.

Implementation checklist:

- [ ] Register scheduled task server routes/runtime.
- [ ] Register sidebar/header action.
- [ ] Register dialogs/overlays.
- [ ] Preserve quit confirmation risk integration.
- [ ] Preserve OpenChamber SSE task events.

Acceptance criteria:

- [ ] Scheduled tasks behave as before.
- [ ] Shutdown cleanup and quit risk tracking remain correct.

Notes:

- Background timers need deterministic shutdown.

### PLUG-FEATURE-PREVIEW-001: Preview Plugin

Status: [ ]

Depends on:

- Plugin server contribution runtime is available.
- PLUG-WORKBENCH-004 if context preview/browser renderer is included

Current files:

- `packages/web/server/lib/preview/proxy-runtime.js`
- preview/browser context panel logic.

Target plugin:

- `openchamber.plugin.preview`

Contribution IDs:

- `preview.proxy`
- `workbench.context-panel.renderer.preview`
- `workbench.context-panel.renderer.browser`

Scope:

- Migrate preview proxy and preview/browser UI renderers.

Implementation checklist:

- [ ] Register preview proxy routes/WS handler.
- [ ] Preserve SSRF protections and header stripping.
- [ ] Register preview/browser context renderers.
- [ ] Add route/WS ordering tests.

Acceptance criteria:

- [ ] Preview proxy behavior is unchanged.
- [ ] Preview WS does not steal other WS upgrades.

Notes:

- This is high security risk.

### PLUG-FEATURE-TUNNELS-001: Tunnels Plugin

Status: [ ]

Depends on:

- Plugin server contribution runtime is available.
- PLUG-SETTINGS-001

Current files:

- `packages/web/server/lib/tunnels/*`
- `packages/web/server/lib/opencode/tunnel-*`
- tunnel settings components.

Target plugin:

- `openchamber.plugin.tunnels`

Contribution IDs:

- `tunnels.registry`
- `tunnels.provider.cloudflare`
- `settings.tunnel`

Scope:

- Migrate tunnel registry/provider/settings into plugin model.

Implementation checklist:

- [ ] Register tunnel settings section.
- [ ] Register Cloudflare tunnel provider as built-in provider contribution.
- [ ] Preserve tunnel auth/session behavior.
- [ ] Preserve tunnel token invalidation behavior.

Acceptance criteria:

- [ ] Tunnel behavior is unchanged.
- [ ] Provider registry can support future tunnel providers.

Notes:

- Tunnel auth has security-sensitive public access flows.

### PLUG-FEATURE-QUOTA-001: Quota Plugin

Status: [ ]

Depends on:

- Plugin server contribution runtime is available.

Current files:

- `packages/web/server/lib/quota/*`
- quota UI/header usage surfaces.

Target plugin:

- `openchamber.plugin.quota`

Contribution IDs:

- `quota.registry`
- `quota.provider.*`

Scope:

- Migrate quota provider registry and usage UI integration.

Implementation checklist:

- [ ] Register quota server routes.
- [ ] Register built-in quota providers.
- [ ] Register usage/settings UI surfaces if applicable.
- [ ] Preserve credential redaction.

Acceptance criteria:

- [ ] Quota behavior is unchanged.
- [ ] Future provider contribution path is clear.

Notes:

- Providers may read credentials; logging must redact.

### PLUG-FEATURE-MAGIC-PROMPTS-001: Magic Prompts Plugin

Status: [ ]

Depends on:

- PLUG-SETTINGS-001
- Plugin server contribution runtime is available.

Current files:

- `packages/web/server/lib/magic-prompts/*`
- magic prompts settings components.

Target plugin:

- `openchamber.plugin.magic-prompts`

Contribution IDs:

- `magic-prompts.routes`
- `settings.magic-prompts`

Scope:

- Migrate magic prompt routes and settings page/sections.

Implementation checklist:

- [ ] Register magic prompt server routes.
- [ ] Register settings page/section.
- [ ] Gate by feature if desired.

Acceptance criteria:

- [ ] Magic prompt behavior is unchanged.

Notes:

- Low-risk compared to Git/terminal/auth.

### PLUG-FEATURE-MINI-CHAT-001: Mini Chat Plugin

Status: [ ]

Depends on:

- PLUG-FEATURE-CHAT-001
- Plugin runtime capability facade is available.

Current files:

- `packages/ui/src/apps/ElectronMiniChatApp.tsx`
- `packages/ui/src/components/mini-chat/*`
- Electron mini-chat window code.

Target plugin:

- `openchamber.plugin.mini-chat`

Contribution IDs:

- `mini-chat.layout`

Scope:

- Register mini-chat as Electron-specific built-in plugin/root surface.

Implementation checklist:

- [ ] Register mini-chat runtime target.
- [ ] Preserve mini-chat bootstrap and session presence.
- [ ] Preserve Electron window behavior.

Acceptance criteria:

- [ ] Mini-chat behavior is unchanged.
- [ ] Plugin target is Electron-specific and explicit.

Notes:

- This is not a generic web/VS Code surface.

## Completion Tracking

When a task is completed, update:

- Status line to `[x]`.
- Acceptance criteria checkboxes.
- Notes with relevant implementation details or follow-up tasks.
- Add links to PRs/commits if available.

When a task is blocked, update:

- Status line to `[!]`.
- Notes with blocker details.
- Add a follow-up task if the blocker requires separate work.

## Suggested Migration Order

1. PLUG-WORKBENCH-001
2. PLUG-WORKBENCH-002
3. PLUG-WORKBENCH-003
4. PLUG-FEATURE-TERMINAL-001
5. PLUG-FEATURE-FILES-001
6. PLUG-FEATURE-GIT-001
7. PLUG-WORKBENCH-004
8. PLUG-SETTINGS-001
9. PLUG-COMMANDS-001
10. PLUG-SLASH-COMMANDS-001
11. PLUG-TOOLS-001
12. PLUG-MODELS-001
13. PLUG-FEATURE-CHAT-001
14. PLUG-FEATURE-DIFF-001
15. PLUG-FEATURE-PLAN-001
16. PLUG-FEATURE-GITHUB-001
17. PLUG-AUTH-001
18. Continue through the remaining feature backlog in dependency order.

This order can be adjusted, but the first three feature migrations should remain terminal, files, and Git because together they validate UI surfaces, server routes, runtime APIs, route gating, and disabled-feature behavior.
