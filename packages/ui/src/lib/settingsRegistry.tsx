import React from "react";
import { SettingsPageRegistry, type SettingsRuntimeContext } from "@openchamber/plugin";
import { Icon } from "@/components/icon/Icon";
import type { IconName } from "@/components/icon/icons";
import { useI18n } from "@/lib/i18n";
import {
  SETTINGS_PAGE_METADATA,
  getSettingsPageMeta,
  resolveSettingsSlug,
} from "@/lib/settings/metadata";
import { getSettingsNavIcon } from "@/components/views/SettingsView";

// Core settings page components
import { AgentsSidebar } from "@/components/sections/agents/AgentsSidebar";
import { AgentsPage } from "@/components/sections/agents/AgentsPage";
import { BehaviorPage } from "@/components/sections/behavior/BehaviorPage";
import { CommandsSidebar } from "@/components/sections/commands/CommandsSidebar";
import { CommandsPage } from "@/components/sections/commands/CommandsPage";
import { McpSidebar } from "@/components/sections/mcp/McpSidebar";
import { McpPage } from "@/components/sections/mcp/McpPage";
import { SkillsSidebar } from "@/components/sections/skills/SkillsSidebar";
import { SkillsPage } from "@/components/sections/skills/SkillsPage";
import { ProjectsSidebar } from "@/components/sections/projects/ProjectsSidebar";
import { ProjectsPage } from "@/components/sections/projects/ProjectsPage";
import { RemoteInstancesSidebar } from "@/components/sections/remote-instances/RemoteInstancesSidebar";
import { RemoteInstancesPage } from "@/components/sections/remote-instances/RemoteInstancesPage";
import { ProvidersSidebar } from "@/components/sections/providers/ProvidersSidebar";
import { ProvidersPage } from "@/components/sections/providers/ProvidersPage";
import { UsageSidebar } from "@/components/sections/usage/UsageSidebar";
import { UsagePage } from "@/components/sections/usage/UsagePage";
import { MagicPromptsSidebar } from "@/components/sections/magic-prompts/MagicPromptsSidebar";
import { MagicPromptsPage } from "@/components/sections/magic-prompts/MagicPromptsPage";
import { GitPage } from "@/components/sections/git-identities/GitPage";
import type { OpenChamberSection } from "@/components/sections/openchamber/types";
import { OpenChamberPage } from "@/components/sections/openchamber/OpenChamberPage";
import { PluginDiagnosticsView } from "@/components/sections/PluginDiagnosticsView";

let registry: SettingsPageRegistry | null = null;

function makeIcon(name: IconName): React.ComponentType<{ className?: string }> {
  return (props) => <Icon name={name} className={props.className} />;
}

const openChamberSectionBySlug: Record<string, OpenChamberSection> = {
  appearance: "visual",
  chat: "chat",
  shortcuts: "shortcuts",
  sessions: "sessions",
  notifications: "notifications",
  voice: "voice",
  tunnel: "tunnel",
};

export function getSettingsPageRegistry(): SettingsPageRegistry {
  if (!registry) {
    registry = new SettingsPageRegistry();

    for (const page of SETTINGS_PAGE_METADATA) {
      const slug = page.slug;
      const iconName = getSettingsNavIcon(page.slug);
      const iconComponent = iconName ? makeIcon(iconName) : null;

      let renderSidebar: React.ComponentType<{ onItemSelect?: () => void }> | undefined;
      let renderContent: React.ComponentType;

      switch (slug) {
        case "projects":
          renderSidebar = ProjectsSidebar;
          renderContent = ProjectsPage;
          break;
        case "remote-instances":
          renderSidebar = RemoteInstancesSidebar;
          renderContent = RemoteInstancesPage;
          break;
        case "agents":
          renderSidebar = AgentsSidebar;
          renderContent = AgentsPage;
          break;
        case "behavior":
          renderContent = BehaviorPage;
          break;
        case "commands":
          renderSidebar = CommandsSidebar;
          renderContent = CommandsPage;
          break;
        case "mcp":
          renderSidebar = McpSidebar;
          renderContent = McpPage;
          break;
        case "skills.installed":
          renderSidebar = SkillsSidebar;
          renderContent = () => <SkillsPage view="installed" />;
          break;
        case "skills.catalog":
          renderContent = () => <SkillsPage view="catalog" />;
          break;
        case "providers":
          renderSidebar = ProvidersSidebar;
          renderContent = ProvidersPage;
          break;
        case "usage":
          renderSidebar = UsageSidebar;
          renderContent = UsagePage;
          break;
        case "magic-prompts":
          renderSidebar = MagicPromptsSidebar;
          renderContent = MagicPromptsPage;
          break;
        case "git":
          renderContent = GitPage;
          break;
        case "plugin-diagnostics":
          renderContent = PluginDiagnosticsView;
          break;
        case "appearance":
        case "chat":
        case "shortcuts":
        case "sessions":
        case "notifications":
        case "voice":
        case "tunnel": {
          const section = openChamberSectionBySlug[slug] ?? "visual";
          renderContent = () => <OpenChamberPage section={section} />;
          break;
        }
        default:
          renderContent = () => null;
      }

      registry.registerPage(
        slug,
        {
          title: page.title,
          group: page.group,
          kind: page.kind,
          description: page.description,
          keywords: page.keywords,
          icon: iconComponent,
          isAvailable: page.isAvailable,
          priority: 0,
          isCore: true,
          renderSidebar,
          renderContent,
        },
        "openchamber.core",
        "builtin",
      );
    }
  }

  return registry;
}

export function useSettingsPages(runtimeCtx: SettingsRuntimeContext) {
  const { t } = useI18n();
  const reg = getSettingsPageRegistry();

  const pages = React.useMemo(() => {
    return reg.getAllPages({ runtimeContext: runtimeCtx }).filter((p) => p.slug !== "home");
  }, [reg, runtimeCtx]);

  const pagesWithLabels = React.useMemo(() => {
    return pages.map((page) => {
      const meta = getSettingsPageMeta(page.slug);
      const i18nKey = meta ? `settings.page.${page.slug.replace(".", "")}.title` : null;
      const label = i18nKey ? (t(i18nKey as never) || page.title) : page.title;
      return { ...page, label };
    });
  }, [pages, t]);

  return pagesWithLabels;
}

export function resolveSettingsPageSlug(value: string | null | undefined): string {
  const normalized = (value ?? "").trim().toLowerCase();
  if (!normalized) {
    return "home";
  }

  const reg = getSettingsPageRegistry();
  if (reg.hasPage(normalized)) {
    return normalized;
  }

  const legacy = resolveSettingsSlug(normalized);
  if (legacy) {
    return legacy;
  }

  return "home";
}
