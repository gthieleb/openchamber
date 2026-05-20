import type { PluginSource } from "./types";
import type { SettingsPageContribution, SettingsPageConfig, SettingsPageContributionRecord, SettingsRuntimeContext } from "./settings-types";

const SOURCE_ORDER: Record<PluginSource, number> = {
  builtin: 0,
  bundled: 1,
  user: 2,
};

export class SettingsPageRegistry {
  private pages = new Map<string, SettingsPageContribution>();
  private records: SettingsPageContributionRecord[] = [];

  registerPage(
    slug: string,
    config: SettingsPageConfig,
    pluginId: string,
    source: PluginSource,
  ): void {
    if (this.pages.has(slug)) {
      throw new Error(`Duplicate settings page slug: "${slug}"`);
    }

    const contribution: SettingsPageContribution = {
      type: "settingsPage",
      slug,
      title: config.title,
      group: config.group,
      kind: config.kind ?? "single",
      description: config.description,
      keywords: config.keywords,
      icon: config.icon,
      isAvailable: config.isAvailable,
      renderSidebar: config.renderSidebar,
      renderContent: config.renderContent,
      pluginId,
      source,
      priority: config.priority ?? 0,
      featureId: config.featureId,
      isCore: config.isCore ?? false,
    };

    this.pages.set(slug, contribution);
    this.records.push({
      slug,
      pluginId,
      source,
      priority: contribution.priority,
      data: contribution,
    });
  }

  getPage(slug: string): SettingsPageContribution | undefined {
    return this.pages.get(slug);
  }

  getAllPages(
    filters?: {
      enabledFeatures?: Set<string>;
      enabledPlugins?: Set<string>;
      runtimeContext?: SettingsRuntimeContext;
    },
  ): SettingsPageContribution[] {
    let pages = Array.from(this.pages.values());

    if (filters?.runtimeContext) {
      pages = pages.filter(
        (p) => !p.isAvailable || p.isAvailable(filters.runtimeContext!),
      );
    }

    if (filters?.enabledFeatures) {
      pages = pages.filter(
        (p) => !p.featureId || filters.enabledFeatures!.has(p.featureId),
      );
    }

    if (filters?.enabledPlugins) {
      pages = pages.filter((p) => filters.enabledPlugins!.has(p.pluginId));
    }

    return [...pages].sort((a, b) => {
      const sourceDiff = SOURCE_ORDER[a.source] - SOURCE_ORDER[b.source];
      if (sourceDiff !== 0) return sourceDiff;
      return a.priority - b.priority;
    });
  }

  hasPage(slug: string): boolean {
    return this.pages.has(slug);
  }

  getPagesByGroup(
    group: string,
    filters?: {
      enabledFeatures?: Set<string>;
      enabledPlugins?: Set<string>;
      runtimeContext?: SettingsRuntimeContext;
    },
  ): SettingsPageContribution[] {
    return this.getAllPages(filters).filter((p) => p.group === group);
  }

  getAllRecords(): SettingsPageContributionRecord[] {
    return [...this.records].sort((a, b) => {
      const sourceDiff = SOURCE_ORDER[a.source] - SOURCE_ORDER[b.source];
      if (sourceDiff !== 0) return sourceDiff;
      return a.priority - b.priority;
    });
  }

  getContributionCount(): number {
    return this.records.length;
  }
}
