import type { PluginSource } from "./types";
import type { SettingsRuntimeContext } from "./settings-types";
import type {
  SettingsSectionConfig,
  SettingsSectionContribution,
  SettingsSectionContributionRecord,
} from "./settings-section-types";

const SOURCE_ORDER: Record<PluginSource, number> = {
  builtin: 0,
  bundled: 1,
  user: 2,
};

export class SettingsSectionRegistry {
  private sections = new Map<string, SettingsSectionContribution>();
  private records: SettingsSectionContributionRecord[] = [];

  registerSection(
    pageSlug: string,
    sectionId: string,
    config: SettingsSectionConfig,
    pluginId: string,
    source: PluginSource,
  ): void {
    const key = `${pageSlug}:${sectionId}`;
    if (this.sections.has(key)) {
      throw new Error(`Duplicate settings section: "${sectionId}" on page "${pageSlug}"`);
    }

    const contribution: SettingsSectionContribution = {
      type: "settingsSection",
      pageSlug,
      sectionId,
      title: config.title,
      description: config.description,
      renderContent: config.renderContent,
      pluginId,
      source,
      priority: config.priority ?? 0,
      featureId: config.featureId,
      isAvailable: config.isAvailable,
    };

    this.sections.set(key, contribution);
    this.records.push({
      pageSlug,
      sectionId,
      pluginId,
      source,
      priority: contribution.priority,
      data: contribution,
    });
  }

  getSection(pageSlug: string, sectionId: string): SettingsSectionContribution | undefined {
    return this.sections.get(`${pageSlug}:${sectionId}`);
  }

  getSectionsForPage(
    pageSlug: string,
    filters?: {
      enabledFeatures?: Set<string>;
      enabledPlugins?: Set<string>;
      runtimeContext?: SettingsRuntimeContext;
    },
  ): SettingsSectionContribution[] {
    let sections = Array.from(this.sections.values()).filter(
      (s) => s.pageSlug === pageSlug,
    );

    if (filters?.runtimeContext) {
      sections = sections.filter(
        (s) => !s.isAvailable || s.isAvailable(filters.runtimeContext!),
      );
    }

    if (filters?.enabledFeatures) {
      sections = sections.filter(
        (s) => !s.featureId || filters.enabledFeatures!.has(s.featureId),
      );
    }

    if (filters?.enabledPlugins) {
      sections = sections.filter((s) => filters.enabledPlugins!.has(s.pluginId));
    }

    return [...sections].sort((a, b) => {
      const sourceDiff = SOURCE_ORDER[a.source] - SOURCE_ORDER[b.source];
      if (sourceDiff !== 0) return sourceDiff;
      return a.priority - b.priority;
    });
  }

  hasSection(pageSlug: string, sectionId: string): boolean {
    return this.sections.has(`${pageSlug}:${sectionId}`);
  }

  getAllRecords(): SettingsSectionContributionRecord[] {
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
