import type { PluginSource } from "./types";
import type { ContextPanelRendererContribution, ContextPanelRendererConfig, ContextPanelRendererRecord } from "./context-panel-types";

const SOURCE_ORDER: Record<PluginSource, number> = {
  builtin: 0,
  bundled: 1,
  user: 2,
};

export class ContextPanelRendererRegistry {
  private renderers = new Map<string, ContextPanelRendererContribution>();
  private records: ContextPanelRendererRecord[] = [];

  registerRenderer(
    mode: string,
    config: ContextPanelRendererConfig,
    pluginId: string,
    source: PluginSource,
  ): void {
    if (this.renderers.has(mode)) {
      throw new Error(`Duplicate context panel renderer mode: "${mode}"`);
    }

    const contribution: ContextPanelRendererContribution = {
      type: "contextPanelRenderer",
      mode,
      label: config.label,
      icon: config.icon,
      render: config.render,
      pluginId,
      source,
      priority: config.priority ?? 0,
      featureId: config.featureId,
      isCore: config.isCore ?? false,
    };

    this.renderers.set(mode, contribution);
    this.records.push({
      mode,
      pluginId,
      source,
      priority: contribution.priority,
      data: contribution,
    });
  }

  getRenderer(mode: string): ContextPanelRendererContribution | undefined {
    return this.renderers.get(mode);
  }

  getAllRenderers(
    filters?: {
      enabledFeatures?: Set<string>;
      enabledPlugins?: Set<string>;
    },
  ): ContextPanelRendererContribution[] {
    let renderers = Array.from(this.renderers.values());

    if (filters?.enabledFeatures) {
      renderers = renderers.filter(
        (r) => !r.featureId || filters.enabledFeatures!.has(r.featureId),
      );
    }

    if (filters?.enabledPlugins) {
      renderers = renderers.filter((r) => filters.enabledPlugins!.has(r.pluginId));
    }

    return [...renderers].sort((a, b) => {
      const sourceDiff = SOURCE_ORDER[a.source] - SOURCE_ORDER[b.source];
      if (sourceDiff !== 0) return sourceDiff;
      return a.priority - b.priority;
    });
  }

  hasRenderer(mode: string): boolean {
    return this.renderers.has(mode);
  }

  isValidMode(mode: string): boolean {
    return this.renderers.has(mode);
  }

  getAllRecords(): ContextPanelRendererRecord[] {
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
