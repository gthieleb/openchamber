import React from "react";
import { registerUIPlugin as registerTerminalUI } from "@openchamber/plugin-terminal";
import { registerUIPlugin as registerFilesUI } from "@openchamber/plugin-files";
import { registerUIPlugin as registerGitUI } from "@openchamber/plugin-git";
import { registerUIPlugin as registerGitHubUI } from "@openchamber/plugin-github";
import { registerUIPlugin as registerChatUI } from "@openchamber/plugin-chat";
import { registerUIPlugin as registerHelloWorldUI } from "@openchamber/plugin-hello-world";
import { lazyWithChunkRecovery } from "@/lib/chunkLoadRecovery";
import { getMainTabRegistry } from "./mainTabRegistry";
import { getBottomDockRegistry } from "./bottomDockRegistry";
import { getRightPanelRegistry } from "./rightPanelRegistry";
import { getSettingsPageRegistry } from "./settingsRegistry";
import type { SettingsPageGroup, SettingsRuntimeContext } from "@openchamber/plugin";

const TerminalView = lazyWithChunkRecovery(() => import("@/components/views/TerminalView").then((m) => ({ default: m.TerminalView })));
const FilesView = lazyWithChunkRecovery(() => import("@/components/views/FilesView").then((m) => ({ default: m.FilesView })));
const GitView = lazyWithChunkRecovery(() => import("@/components/views/GitView").then((m) => ({ default: m.GitView })));
const ChatView = React.lazy(() => import("@/components/views/ChatView").then((m) => ({ default: m.ChatView })));
const SidebarFilesTree = lazyWithChunkRecovery(() => import("@/components/layout/SidebarFilesTree").then((m) => ({ default: m.SidebarFilesTree })));
const GitHubSettings = lazyWithChunkRecovery(() => import("@/components/sections/openchamber/GitHubSettings").then((m) => ({ default: m.GitHubSettings })));

let initialized = false;

export function initializePluginUI() {
  if (initialized) return;
  initialized = true;

  const ctx = {
    ui: {
      surface: (id: string, config: {
        title: string;
        placements: string[];
        render: React.ComponentType<unknown>;
        featureId?: string;
        priority?: number;
        isCore?: boolean;
      }) => {
        const mainTabRegistry = getMainTabRegistry();
        const bottomDockRegistry = getBottomDockRegistry();

        for (const placement of config.placements) {
          if (placement === "workbench.main") {
            // Use full surface ID with dots replaced to avoid conflicts
            // with existing hardcoded tab IDs (chat, git, files, etc.)
            const tabId = id.replace(/\./g, "-");
            mainTabRegistry.registerTab(tabId, {
              label: config.title,
              render: config.render,
              priority: config.priority ?? 0,
              featureId: config.featureId,
              isCore: config.isCore,
            }, "openchamber.core", "builtin");
          }

          if (placement === "workbench.bottom-dock") {
            bottomDockRegistry.registerSurface(id, {
              label: config.title,
              render: config.render,
              priority: config.priority ?? 0,
              featureId: config.featureId,
              isCore: config.isCore,
            }, "openchamber.core", "builtin");
          }
        }
      },
      slot: (id: string, config: {
        render: React.ComponentType<unknown>;
        featureId?: string;
      }) => {
        const rightPanelRegistry = getRightPanelRegistry();

        if (id.startsWith("workbench.right-panel.")) {
          const tabId = id.replace("workbench.right-panel.", "");
          rightPanelRegistry.registerTab(tabId, {
            label: tabId.charAt(0).toUpperCase() + tabId.slice(1),
            render: config.render,
            priority: 0,
            featureId: config.featureId,
            isCore: true,
          }, "openchamber.core", "builtin");
        }
      },
      settingsPage: (slug: string, config: {
        title: string;
        group: SettingsPageGroup;
        kind?: "single" | "split";
        description?: string;
        keywords?: string[];
        icon?: React.ComponentType<{ className?: string }> | null;
        isAvailable?: (ctx: SettingsRuntimeContext) => boolean;
        renderSidebar?: React.ComponentType<{ onItemSelect?: () => void }>;
        renderContent: React.ComponentType;
        priority?: number;
        featureId?: string;
        isCore?: boolean;
      }) => {
        const settingsPageRegistry = getSettingsPageRegistry();
        settingsPageRegistry.registerPage(slug, {
          title: config.title,
          group: config.group,
          kind: config.kind ?? "single",
          description: config.description,
          keywords: config.keywords,
          icon: config.icon,
          isAvailable: config.isAvailable,
          renderSidebar: config.renderSidebar,
          renderContent: config.renderContent,
          priority: config.priority ?? 0,
          featureId: config.featureId,
          isCore: config.isCore ?? false,
        }, "openchamber.core", "builtin");
      },
    },
  };

  registerTerminalUI(ctx, { TerminalView: TerminalView as React.ComponentType<unknown> });
  registerFilesUI(ctx, {
    FilesView: FilesView as React.ComponentType<unknown>,
    FilesRightPanel: SidebarFilesTree as React.ComponentType<unknown>,
  });
  registerGitUI(ctx, {
    GitView: GitView as React.ComponentType<unknown>,
    GitRightPanel: GitView as React.ComponentType<unknown>,
  });
  registerGitHubUI(ctx, { GitHubSettings: GitHubSettings as React.ComponentType<unknown> });
  registerChatUI(ctx, { ChatView: ChatView as React.ComponentType<unknown> });
  registerHelloWorldUI(ctx, {});
}
