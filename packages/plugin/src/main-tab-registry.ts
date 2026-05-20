import type { PluginSource } from "./types";
import type { MainTabContribution, MainTabConfig, MainTabContributionRecord } from "./main-tab-types";

const SOURCE_ORDER: Record<PluginSource, number> = {
  builtin: 0,
  bundled: 1,
  user: 2,
};

export class MainTabRegistry {
  private tabs = new Map<string, MainTabContribution>();
  private records: MainTabContributionRecord[] = [];

  registerTab(
    tabId: string,
    config: MainTabConfig,
    pluginId: string,
    source: PluginSource,
  ): void {
    if (this.tabs.has(tabId)) {
      throw new Error(`Duplicate main tab ID: "${tabId}"`);
    }

    const contribution: MainTabContribution = {
      type: "mainTab",
      tabId,
      label: config.label,
      icon: config.icon,
      render: config.render,
      pluginId,
      source,
      priority: config.priority ?? 0,
      featureId: config.featureId,
      isCore: config.isCore ?? false,
    };

    this.tabs.set(tabId, contribution);
    this.records.push({
      tabId,
      pluginId,
      source,
      priority: contribution.priority,
      data: contribution,
    });
  }

  getTab(tabId: string): MainTabContribution | undefined {
    return this.tabs.get(tabId);
  }

  getAllTabs(
    filters?: {
      enabledFeatures?: Set<string>;
      enabledPlugins?: Set<string>;
    },
  ): MainTabContribution[] {
    let tabs = Array.from(this.tabs.values());

    if (filters?.enabledFeatures) {
      tabs = tabs.filter(
        (t) => !t.featureId || filters.enabledFeatures!.has(t.featureId),
      );
    }

    if (filters?.enabledPlugins) {
      tabs = tabs.filter((t) => filters.enabledPlugins!.has(t.pluginId));
    }

    return [...tabs].sort((a, b) => {
      const sourceDiff = SOURCE_ORDER[a.source] - SOURCE_ORDER[b.source];
      if (sourceDiff !== 0) return sourceDiff;
      return a.priority - b.priority;
    });
  }

  hasTab(tabId: string): boolean {
    return this.tabs.has(tabId);
  }

  isValidTabId(tabId: string): boolean {
    return this.tabs.has(tabId);
  }

  getFallbackTabId(): string | undefined {
    const coreTabs = Array.from(this.tabs.values())
      .filter((t) => t.isCore)
      .sort((a, b) => a.priority - b.priority);
    if (coreTabs.length > 0) return coreTabs[0].tabId;

    const allTabs = Array.from(this.tabs.values())
      .sort((a, b) => a.priority - b.priority);
    return allTabs.length > 0 ? allTabs[0].tabId : undefined;
  }

  sanitizeTabId(tabId: string): string | undefined {
    if (this.tabs.has(tabId)) return tabId;
    return this.getFallbackTabId();
  }

  getAllRecords(): MainTabContributionRecord[] {
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
