import React from "react";
import { CommandRegistry } from "@openchamber/plugin";
import { Icon } from "@/components/icon/Icon";
import { useI18n } from "@/lib/i18n";
import { useUIStore } from "@/stores/useUIStore";
import { useSessionUIStore } from "@/sync/session-ui-store";
import { useDirectoryStore } from "@/stores/useDirectoryStore";
import { useProjectsStore } from "@/stores/useProjectsStore";
import { canUseElectronDesktopIPC, invokeDesktop } from "@/lib/desktop";
import { sessionEvents } from "@/lib/sessionEvents";
import { createWorktreeSession } from "@/lib/worktreeSessionCreator";

let registry: CommandRegistry | null = null;

function makeIcon(name: string): React.ComponentType<{ className?: string }> {
  return (props) => <Icon name={name} className={props.className} />;
}

const normalizePath = (value: string): string => {
  if (!value) return '';
  const raw = value.replace(/\\/g, '/');
  const hadUncPrefix = raw.startsWith('//');
  let normalized = raw.replace(/\/+/g, '/');
  if (hadUncPrefix && !normalized.startsWith('//')) normalized = `/${normalized}`;
  const isUnixRoot = normalized === '/';
  const isWindowsDriveRoot = /^[A-Za-z]:\/$/.test(normalized);
  if (!isUnixRoot && !isWindowsDriveRoot) normalized = normalized.replace(/\/+$/, '');
  return normalized;
};

export function getCommandRegistry(): CommandRegistry {
  if (!registry) {
    registry = new CommandRegistry();

    registry.registerCommand(
      "openchamber.command.new-session",
      {
        title: "New Session",
        group: "session",
        icon: makeIcon("add"),
        shortcutId: "new_chat",
        keywords: ["chat", "new", "session"],
        run: () => {
          const state = useUIStore.getState();
          const sessionState = useSessionUIStore.getState();
          state.setActiveMainTab("chat");
          state.setSessionSwitcherOpen(false);
          sessionState.openNewSessionDraft();
        },
        priority: 0,
        isCore: true,
      },
      "openchamber.core",
      "builtin",
    );

    registry.registerCommand(
      "openchamber.command.new-worktree",
      {
        title: "New Worktree Session",
        group: "session",
        icon: makeIcon("git-branch"),
        shortcutId: "new_chat_worktree",
        keywords: ["worktree", "branch", "session"],
        run: () => {
          void createWorktreeSession();
        },
        priority: 1,
        isCore: true,
      },
      "openchamber.core",
      "builtin",
    );

    registry.registerCommand(
      "openchamber.command.add-project",
      {
        title: "Add Project",
        group: "navigation",
        icon: makeIcon("folder-add"),
        keywords: ["project", "directory", "folder"],
        run: () => {
          sessionEvents.requestDirectoryDialog();
        },
        priority: 0,
        isCore: true,
      },
      "openchamber.core",
      "builtin",
    );

    registry.registerCommand(
      "openchamber.command.toggle-sidebar",
      {
        title: "Toggle Sidebar",
        group: "view",
        icon: makeIcon("layout-left"),
        shortcutId: "toggle_sidebar",
        keywords: ["sidebar", "toggle"],
        run: () => {
          useUIStore.getState().toggleSidebar();
        },
        priority: 0,
        isCore: true,
      },
      "openchamber.core",
      "builtin",
    );

    registry.registerCommand(
      "openchamber.command.toggle-right-sidebar",
      {
        title: "Toggle Right Sidebar",
        group: "view",
        icon: makeIcon("layout-right"),
        shortcutId: "toggle_right_sidebar",
        keywords: ["right", "sidebar", "toggle", "panel"],
        run: () => {
          useUIStore.getState().toggleRightSidebar();
        },
        priority: 0,
        isCore: true,
      },
      "openchamber.core",
      "builtin",
    );

    registry.registerCommand(
      "openchamber.command.toggle-terminal",
      {
        title: "Toggle Terminal",
        group: "terminal",
        icon: makeIcon("terminal-box"),
        shortcutId: "toggle_terminal",
        keywords: ["terminal", "toggle"],
        run: () => {
          useUIStore.getState().toggleBottomTerminal();
        },
        priority: 0,
        isCore: true,
      },
      "openchamber.core",
      "builtin",
    );

    registry.registerCommand(
      "openchamber.command.context-usage",
      {
        title: "Show Context Usage",
        group: "view",
        icon: makeIcon("pie-chart"),
        keywords: ["context", "usage", "tokens"],
        run: () => {
          const directory = useDirectoryStore.getState().currentDirectory;
          if (directory) useUIStore.getState().openContextOverview(directory);
        },
        priority: 0,
        isCore: true,
      },
      "openchamber.core",
      "builtin",
    );

    registry.registerCommand(
      "openchamber.command.open-settings",
      {
        title: "Open Settings",
        group: "settings",
        icon: makeIcon("settings-3"),
        shortcutId: "open_settings",
        keywords: ["settings", "preferences"],
        run: () => {
          useUIStore.getState().setSettingsDialogOpen(true);
        },
        priority: 0,
        isCore: true,
      },
      "openchamber.core",
      "builtin",
    );

    if (canUseElectronDesktopIPC()) {
      registry.registerCommand(
        "openchamber.command.new-mini-chat",
        {
          title: "New Mini Chat Window",
          group: "session",
          icon: makeIcon("window"),
          shortcutId: "new_mini_chat",
          keywords: ["mini", "window", "chat"],
          isAvailable: () => canUseElectronDesktopIPC(),
          run: () => {
            const currentDirectory = useDirectoryStore.getState().currentDirectory;
            const activeProject = useProjectsStore.getState().getActiveProject();
            void invokeDesktop('desktop_open_draft_mini_chat_window', {
              directory: normalizePath(currentDirectory || activeProject?.path || ''),
              projectId: activeProject?.id ?? null,
            }).catch((error) => {
              console.warn('[command-palette] failed to open draft mini chat window', error);
            });
          },
          priority: 0,
          isCore: true,
        },
        "openchamber.core",
        "builtin",
      );
    }
  }

  return registry;
}

export function useCommands() {
  const { t } = useI18n();
  const reg = getCommandRegistry();

  const commands = React.useMemo(() => {
    return reg.getAllCommands();
  }, [reg]);

  const commandsWithLabels = React.useMemo(() => {
    return commands.map((cmd) => ({
      ...cmd,
      title: t(`commandPalette.item.${cmd.id.replace("openchamber.command.", "")}` as never) || cmd.title,
    }));
  }, [commands, t]);

  return commandsWithLabels;
}

export function executeCommand(id: string): void | Promise<void> {
  const reg = getCommandRegistry();
  return reg.executeCommand(id);
}
