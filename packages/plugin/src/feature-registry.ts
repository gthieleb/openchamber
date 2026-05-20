import type { FeatureDefinition, FeatureEntry, FeatureId, FeatureSnapshot } from "./features";

export class FeatureRegistry {
  private definitions = new Map<FeatureId, FeatureDefinition>();
  private overrides = new Map<FeatureId, boolean>();

  register(def: FeatureDefinition): void {
    if (this.definitions.has(def.id)) {
      throw new Error(`Duplicate feature ID: "${def.id}"`);
    }
    this.definitions.set(def.id, def);
  }

  setEnabled(id: FeatureId, enabled: boolean): void {
    if (!this.definitions.has(id)) {
      return;
    }
    this.overrides.set(id, enabled);
  }

  isEnabled(id: FeatureId): boolean {
    const def = this.definitions.get(id);
    if (!def) {
      return false;
    }
    if (this.overrides.has(id)) {
      return this.overrides.get(id)!;
    }
    return def.enabledByDefault;
  }

  isKnown(id: FeatureId): boolean {
    return this.definitions.has(id);
  }

  getFeature(id: FeatureId): FeatureEntry | undefined {
    const def = this.definitions.get(id);
    if (!def) {
      return undefined;
    }
    const overridden = this.overrides.has(id);
    return {
      id: def.id,
      name: def.name,
      description: def.description,
      enabled: this.isEnabled(id),
      enabledByDefault: def.enabledByDefault,
      pluginId: def.pluginId,
      overridden,
    };
  }

  getSnapshot(): FeatureSnapshot {
    const features: FeatureEntry[] = [];

    for (const def of this.definitions.values()) {
      const overridden = this.overrides.has(def.id);
      features.push({
        id: def.id,
        name: def.name,
        description: def.description,
        enabled: this.isEnabled(def.id),
        enabledByDefault: def.enabledByDefault,
        pluginId: def.pluginId,
        overridden,
      });
    }

    return {
      features,
      updatedAt: new Date().toISOString(),
    };
  }

  getAll(): FeatureEntry[] {
    return this.getSnapshot().features;
  }

  getDefinitions(): FeatureDefinition[] {
    return Array.from(this.definitions.values());
  }
}
