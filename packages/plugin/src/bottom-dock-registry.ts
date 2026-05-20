import type { PluginSource } from "./types";
import type {
  BottomDockSurfaceConfig,
  BottomDockSurfaceContribution,
  BottomDockSurfaceContributionRecord,
} from "./bottom-dock-types";

const SOURCE_ORDER: Record<PluginSource, number> = {
  builtin: 0,
  bundled: 1,
  user: 2,
};

export class BottomDockRegistry {
  private surfaces = new Map<string, BottomDockSurfaceContribution>();
  private records: BottomDockSurfaceContributionRecord[] = [];

  registerSurface(
    surfaceId: string,
    config: BottomDockSurfaceConfig,
    pluginId: string,
    source: PluginSource,
  ): void {
    if (this.surfaces.has(surfaceId)) {
      throw new Error(`Duplicate bottom dock surface ID: "${surfaceId}"`);
    }

    const contribution: BottomDockSurfaceContribution = {
      type: "bottomDock",
      surfaceId,
      label: config.label,
      render: config.render,
      pluginId,
      source,
      priority: config.priority ?? 0,
      featureId: config.featureId,
      isCore: config.isCore ?? false,
    };

    this.surfaces.set(surfaceId, contribution);
    this.records.push({
      surfaceId,
      pluginId,
      source,
      priority: contribution.priority,
      data: contribution,
    });
  }

  getSurface(surfaceId: string): BottomDockSurfaceContribution | undefined {
    return this.surfaces.get(surfaceId);
  }

  getAllSuraces(
    filters?: {
      enabledFeatures?: Set<string>;
      enabledPlugins?: Set<string>;
    },
  ): BottomDockSurfaceContribution[] {
    let surfaces = Array.from(this.surfaces.values());

    if (filters?.enabledFeatures) {
      surfaces = surfaces.filter(
        (s) => !s.featureId || filters.enabledFeatures!.has(s.featureId),
      );
    }

    if (filters?.enabledPlugins) {
      surfaces = surfaces.filter((s) => filters.enabledPlugins!.has(s.pluginId));
    }

    return [...surfaces].sort((a, b) => {
      const sourceDiff = SOURCE_ORDER[a.source] - SOURCE_ORDER[b.source];
      if (sourceDiff !== 0) return sourceDiff;
      return a.priority - b.priority;
    });
  }

  hasSurface(surfaceId: string): boolean {
    return this.surfaces.has(surfaceId);
  }

  getFallbackSurfaceId(): string | undefined {
    const coreSurfaces = Array.from(this.surfaces.values())
      .filter((s) => s.isCore)
      .sort((a, b) => a.priority - b.priority);
    if (coreSurfaces.length > 0) return coreSurfaces[0].surfaceId;

    const allSurfaces = Array.from(this.surfaces.values())
      .sort((a, b) => a.priority - b.priority);
    return allSurfaces.length > 0 ? allSurfaces[0].surfaceId : undefined;
  }

  sanitizeSurfaceId(surfaceId: string): string | undefined {
    if (this.surfaces.has(surfaceId)) return surfaceId;
    return this.getFallbackSurfaceId();
  }

  getAllRecords(): BottomDockSurfaceContributionRecord[] {
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
