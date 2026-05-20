import type { ComponentType, ReactNode } from "react";
import type {
  UIFillContribution,
  UIWrapContribution,
  UIReplaceContribution,
  UISurfaceContribution,
  UISlotContribution,
  UIContributionOptions,
  UISurfaceConfig,
  UISlotConfig,
  UIContributionRecord,
} from "./ui-types";
import type { PluginSource } from "./types";

const SOURCE_ORDER: Record<PluginSource, number> = {
  builtin: 0,
  bundled: 1,
  user: 2,
};

export class UIContributionRegistry {
  private fills = new Map<string, UIFillContribution[]>();
  private surfaces = new Map<string, UISurfaceContribution>();
  private slots = new Map<string, UISlotContribution>();
  private replaces = new Map<string, UIReplaceContribution[]>();
  private wraps = new Map<string, UIWrapContribution[]>();
  private contributions: UIContributionRecord[] = [];
  private replacementConflicts: Map<string, string[]> = new Map();

  registerFill(
    slotId: string,
    component: ComponentType<unknown> | (() => ReactNode),
    pluginId: string,
    source: PluginSource,
    options?: UIContributionOptions,
  ): void {
    const contribution: UIFillContribution = {
      type: "fill",
      slotId,
      component,
      priority: options?.priority ?? 0,
      pluginId,
      featureId: options?.featureId,
    };

    const slotFills = this.fills.get(slotId) ?? [];
    slotFills.push(contribution);
    this.fills.set(slotId, slotFills);

    this.contributions.push({
      type: "fill",
      id: `${slotId}:${pluginId}:${slotFills.length}`,
      pluginId,
      source,
      priority: contribution.priority,
      data: contribution,
    });
  }

  registerSurface(
    surfaceId: string,
    config: UISurfaceConfig,
    pluginId: string,
    source: PluginSource,
  ): void {
    if (this.surfaces.has(surfaceId)) {
      throw new Error(`Duplicate surface ID: "${surfaceId}"`);
    }

    const contribution: UISurfaceContribution = {
      type: "surface",
      surfaceId,
      title: config.title,
      placements: config.placements,
      render: config.render,
      pluginId,
      featureId: config.featureId,
    };

    this.surfaces.set(surfaceId, contribution);

    this.contributions.push({
      type: "surface",
      id: surfaceId,
      pluginId,
      source,
      priority: 0,
      data: contribution,
    });
  }

  registerSlot(
    slotId: string,
    config: UISlotConfig,
    pluginId: string,
    source: PluginSource,
  ): void {
    if (this.slots.has(slotId)) {
      throw new Error(`Duplicate slot ID: "${slotId}"`);
    }

    const contribution: UISlotContribution = {
      type: "slot",
      slotId,
      render: config.render as ComponentType<unknown>,
      pluginId,
      featureId: config.featureId,
    };

    this.slots.set(slotId, contribution);

    this.contributions.push({
      type: "slot",
      id: slotId,
      pluginId,
      source,
      priority: config.priority ?? 0,
      data: contribution,
    });
  }

  registerReplace(
    targetId: string,
    component: ComponentType<unknown>,
    pluginId: string,
    source: PluginSource,
    options?: UIContributionOptions,
  ): void {
    const contribution: UIReplaceContribution = {
      type: "replace",
      targetId,
      component,
      priority: options?.priority ?? 0,
      pluginId,
      featureId: options?.featureId,
    };

    const targetReplaces = this.replaces.get(targetId) ?? [];
    targetReplaces.push(contribution);
    this.replaces.set(targetId, targetReplaces);

    if (targetReplaces.length > 1) {
      const conflictIds = targetReplaces.map((r) => r.pluginId);
      this.replacementConflicts.set(targetId, conflictIds);
    }

    this.contributions.push({
      type: "replace",
      id: `${targetId}:${pluginId}`,
      pluginId,
      source,
      priority: contribution.priority,
      data: contribution,
    });
  }

  registerWrap(
    targetId: string,
    wrapper: (props: { children: ReactNode }) => ReactNode,
    pluginId: string,
    source: PluginSource,
    options?: UIContributionOptions,
  ): void {
    const contribution: UIWrapContribution = {
      type: "wrap",
      targetId,
      wrapper,
      priority: options?.priority ?? 0,
      pluginId,
      featureId: options?.featureId,
    };

    const targetWraps = this.wraps.get(targetId) ?? [];
    targetWraps.push(contribution);
    this.wraps.set(targetId, targetWraps);

    this.contributions.push({
      type: "wrap",
      id: `${targetId}:${pluginId}`,
      pluginId,
      source,
      priority: contribution.priority,
      data: contribution,
    });
  }

  getFillsForSlot(
    slotId: string,
    filters?: {
      enabledFeatures?: Set<string>;
      enabledPlugins?: Set<string>;
    },
  ): UIFillContribution[] {
    const fills = this.fills.get(slotId) ?? [];
    return this.filterAndSortFills(fills, filters);
  }

  getSurface(surfaceId: string): UISurfaceContribution | undefined {
    return this.surfaces.get(surfaceId);
  }

  getSlot(slotId: string): UISlotContribution | undefined {
    return this.slots.get(slotId);
  }

  getSurfacesForPlacement(
    placement: string,
    filters?: {
      enabledFeatures?: Set<string>;
      enabledPlugins?: Set<string>;
    },
  ): UISurfaceContribution[] {
    const surfaces = Array.from(this.surfaces.values()).filter((s) =>
      s.placements.includes(placement),
    );

    return this.filterSurfaces(surfaces, filters);
  }

  getActiveReplace(
    targetId: string,
    filters?: {
      enabledFeatures?: Set<string>;
      enabledPlugins?: Set<string>;
      selectedPluginId?: string;
    },
  ): UIReplaceContribution | undefined {
    const replaces = this.replaces.get(targetId) ?? [];
    const filtered = this.filterReplaces(replaces, filters);

    if (filtered.length === 0) return undefined;
    if (filtered.length === 1) return filtered[0];

    if (filters?.selectedPluginId) {
      const selected = filtered.find((r) => r.pluginId === filters.selectedPluginId);
      if (selected) return selected;
    }

    const sorted = this.sortReplaces(filtered);
    return sorted[0];
  }

  getWrapsForTarget(
    targetId: string,
    filters?: {
      enabledFeatures?: Set<string>;
      enabledPlugins?: Set<string>;
    },
  ): UIWrapContribution[] {
    const wraps = this.wraps.get(targetId) ?? [];
    return this.filterAndSortWraps(wraps, filters);
  }

  getReplacementConflicts(): Map<string, string[]> {
    return this.replacementConflicts;
  }

  getAllContributions(): UIContributionRecord[] {
    return [...this.contributions].sort((a, b) => {
      const sourceDiff = SOURCE_ORDER[a.source as PluginSource] - SOURCE_ORDER[b.source as PluginSource];
      if (sourceDiff !== 0) return sourceDiff;
      return a.priority - b.priority;
    });
  }

  getContributionCount(): number {
    return this.contributions.length;
  }

  private filterAndSortFills(
    fills: UIFillContribution[],
    filters?: { enabledFeatures?: Set<string>; enabledPlugins?: Set<string> },
  ): UIFillContribution[] {
    let filtered = fills;

    if (filters?.enabledFeatures) {
      filtered = filtered.filter(
        (f) => !f.featureId || filters.enabledFeatures!.has(f.featureId),
      );
    }

    if (filters?.enabledPlugins) {
      filtered = filtered.filter((f) => filters.enabledPlugins!.has(f.pluginId));
    }

    return [...filtered].sort((a, b) => {
      const sourceA = this.getSourceForPlugin();
      const sourceB = this.getSourceForPlugin();
      const sourceDiff = SOURCE_ORDER[sourceA] - SOURCE_ORDER[sourceB];
      if (sourceDiff !== 0) return sourceDiff;
      return b.priority - a.priority;
    });
  }

  private filterSurfaces(
    surfaces: UISurfaceContribution[],
    filters?: { enabledFeatures?: Set<string>; enabledPlugins?: Set<string> },
  ): UISurfaceContribution[] {
    let filtered = surfaces;

    if (filters?.enabledFeatures) {
      filtered = filtered.filter(
        (s) => !s.featureId || filters.enabledFeatures!.has(s.featureId),
      );
    }

    if (filters?.enabledPlugins) {
      filtered = filtered.filter((s) => filters.enabledPlugins!.has(s.pluginId));
    }

    return filtered;
  }

  private filterReplaces(
    replaces: UIReplaceContribution[],
    filters?: { enabledFeatures?: Set<string>; enabledPlugins?: Set<string>; selectedPluginId?: string },
  ): UIReplaceContribution[] {
    let filtered = replaces;

    if (filters?.enabledFeatures) {
      filtered = filtered.filter(
        (r) => !r.featureId || filters.enabledFeatures!.has(r.featureId),
      );
    }

    if (filters?.enabledPlugins) {
      filtered = filtered.filter((r) => filters.enabledPlugins!.has(r.pluginId));
    }

    return filtered;
  }

  private filterAndSortWraps(
    wraps: UIWrapContribution[],
    filters?: { enabledFeatures?: Set<string>; enabledPlugins?: Set<string> },
  ): UIWrapContribution[] {
    let filtered = wraps;

    if (filters?.enabledFeatures) {
      filtered = filtered.filter(
        (w) => !w.featureId || filters.enabledFeatures!.has(w.featureId),
      );
    }

    if (filters?.enabledPlugins) {
      filtered = filtered.filter((w) => filters.enabledPlugins!.has(w.pluginId));
    }

    return [...filtered].sort((a, b) => {
      const sourceA = this.getSourceForPlugin();
      const sourceB = this.getSourceForPlugin();
      const sourceDiff = SOURCE_ORDER[sourceA] - SOURCE_ORDER[sourceB];
      if (sourceDiff !== 0) return sourceDiff;
      return b.priority - a.priority;
    });
  }

  private sortReplaces(replaces: UIReplaceContribution[]): UIReplaceContribution[] {
    return [...replaces].sort((a, b) => {
      const sourceA = this.getSourceForPlugin();
      const sourceB = this.getSourceForPlugin();
      const sourceDiff = SOURCE_ORDER[sourceA] - SOURCE_ORDER[sourceB];
      if (sourceDiff !== 0) return sourceDiff;
      return b.priority - a.priority;
    });
  }

  private getSourceForPlugin(): PluginSource {
    return "builtin";
  }
}
