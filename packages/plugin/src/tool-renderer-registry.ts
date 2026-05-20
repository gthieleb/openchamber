import type { PluginSource } from "./types";
import type {
  ToolRendererContribution,
  ToolRendererConfig,
  ToolRendererContributionRecord,
  ToolIconConfig,
  ToolIconContribution,
  ToolIconContributionRecord,
  ToolMetadataConfig,
  ToolMetadataContribution,
  ToolMetadataContributionRecord,
  ToolClassifierConfig,
  ToolClassifierContribution,
  ToolClassifierContributionRecord,
  ToolLanguageDetectorConfig,
  ToolLanguageDetectorContribution,
  ToolLanguageDetectorContributionRecord,
  ToolSideEffectHintConfig,
  ToolSideEffectHintContribution,
  ToolSideEffectHintContributionRecord,
} from "./tool-renderer-types";

const SOURCE_ORDER: Record<PluginSource, number> = {
  builtin: 0,
  bundled: 1,
  user: 2,
};

export class ToolRendererRegistry {
  private renderers = new Map<string, ToolRendererContribution>();
  private icons = new Map<string, ToolIconContribution>();
  private metadata = new Map<string, ToolMetadataContribution>();
  private classifiers = new Map<string, ToolClassifierContribution>();
  private languageDetectors = new Map<string, ToolLanguageDetectorContribution>();
  private sideEffectHints = new Map<string, ToolSideEffectHintContribution>();
  private rendererRecords: ToolRendererContributionRecord[] = [];
  private iconRecords: ToolIconContributionRecord[] = [];
  private metadataRecords: ToolMetadataContributionRecord[] = [];
  private classifierRecords: ToolClassifierContributionRecord[] = [];
  private languageDetectorRecords: ToolLanguageDetectorContributionRecord[] = [];
  private sideEffectHintRecords: ToolSideEffectHintContributionRecord[] = [];

  registerRenderer(
    toolName: string,
    config: ToolRendererConfig,
    pluginId: string,
    source: PluginSource,
  ): void {
    const matchType = config.matchType ?? "exact";
    const key = `${matchType}:${toolName.toLowerCase()}`;
    if (this.renderers.has(key)) {
      throw new Error(`Duplicate tool renderer for "${key}"`);
    }

    const contribution: ToolRendererContribution = {
      type: "toolRenderer",
      toolName,
      matchType,
      render: config.render,
      pluginId,
      source,
      priority: config.priority ?? 0,
      featureId: config.featureId,
      isCore: config.isCore ?? false,
    };

    this.renderers.set(key, contribution);
    this.rendererRecords.push({
      toolName,
      matchType: contribution.matchType,
      pluginId,
      source,
      priority: contribution.priority,
      data: contribution,
    });
  }

  registerIcon(
    toolName: string,
    config: ToolIconConfig,
    pluginId: string,
    source: PluginSource,
  ): void {
    const matchType = config.matchType ?? "exact";
    const key = `${matchType}:${toolName.toLowerCase()}`;
    if (this.icons.has(key)) {
      throw new Error(`Duplicate tool icon for "${key}"`);
    }

    const contribution: ToolIconContribution = {
      type: "toolIcon",
      toolName,
      matchType,
      icon: config.icon,
      pluginId,
      source,
      priority: config.priority ?? 0,
      featureId: config.featureId,
      isCore: config.isCore ?? false,
    };

    this.icons.set(key, contribution);
    this.iconRecords.push({
      toolName,
      matchType: contribution.matchType,
      pluginId,
      source,
      priority: contribution.priority,
      data: contribution,
    });
  }

  registerMetadata(
    toolName: string,
    config: ToolMetadataConfig,
    pluginId: string,
    source: PluginSource,
  ): void {
    const key = `meta:${toolName.toLowerCase()}`;
    if (this.metadata.has(key)) {
      throw new Error(`Duplicate tool metadata for "${key}"`);
    }

    const contribution: ToolMetadataContribution = {
      type: "toolMetadata",
      toolName,
      matchType: "exact",
      displayName: config.displayName,
      description: config.description,
      pluginId,
      source,
      priority: config.priority ?? 0,
      featureId: config.featureId,
      isCore: config.isCore ?? false,
    };

    this.metadata.set(key, contribution);
    this.metadataRecords.push({
      toolName,
      matchType: "exact",
      pluginId,
      source,
      priority: contribution.priority,
      data: contribution,
    });
  }

  registerClassifier(
    toolName: string,
    config: ToolClassifierConfig,
    pluginId: string,
    source: PluginSource,
  ): void {
    const key = `classifier:${toolName.toLowerCase()}`;
    if (this.classifiers.has(key)) {
      throw new Error(`Duplicate tool classifier for "${key}"`);
    }

    const contribution: ToolClassifierContribution = {
      type: "toolClassifier",
      toolName,
      matchType: "exact",
      classify: config.classify,
      pluginId,
      source,
      priority: config.priority ?? 0,
      featureId: config.featureId,
      isCore: config.isCore ?? false,
    };

    this.classifiers.set(key, contribution);
    this.classifierRecords.push({
      toolName,
      matchType: "exact",
      pluginId,
      source,
      priority: contribution.priority,
      data: contribution,
    });
  }

  registerLanguageDetector(
    toolName: string,
    config: ToolLanguageDetectorConfig,
    pluginId: string,
    source: PluginSource,
  ): void {
    const key = `lang:${toolName.toLowerCase()}`;
    if (this.languageDetectors.has(key)) {
      throw new Error(`Duplicate tool language detector for "${key}"`);
    }

    const contribution: ToolLanguageDetectorContribution = {
      type: "toolLanguageDetector",
      toolName,
      matchType: "exact",
      detectLanguage: config.detectLanguage,
      pluginId,
      source,
      priority: config.priority ?? 0,
      featureId: config.featureId,
      isCore: config.isCore ?? false,
    };

    this.languageDetectors.set(key, contribution);
    this.languageDetectorRecords.push({
      toolName,
      matchType: "exact",
      pluginId,
      source,
      priority: contribution.priority,
      data: contribution,
    });
  }

  registerSideEffectHint(
    toolName: string,
    config: ToolSideEffectHintConfig,
    pluginId: string,
    source: PluginSource,
  ): void {
    const key = `hint:${toolName.toLowerCase()}`;
    if (this.sideEffectHints.has(key)) {
      throw new Error(`Duplicate tool side-effect hint for "${key}"`);
    }

    const contribution: ToolSideEffectHintContribution = {
      type: "toolSideEffectHint",
      toolName,
      matchType: "exact",
      hint: config.hint,
      pluginId,
      source,
      priority: config.priority ?? 0,
      featureId: config.featureId,
      isCore: config.isCore ?? false,
    };

    this.sideEffectHints.set(key, contribution);
    this.sideEffectHintRecords.push({
      toolName,
      matchType: "exact",
      pluginId,
      source,
      priority: contribution.priority,
      data: contribution,
    });
  }

  findRenderer(toolName: string): ToolRendererContribution | undefined {
    const normalized = toolName.toLowerCase();

    const exact = this.renderers.get(`exact:${normalized}`);
    if (exact) return exact;

    const prefixMatches: ToolRendererContribution[] = [];
    for (const renderer of this.renderers.values()) {
      if (renderer.matchType === "prefix" && normalized.startsWith(renderer.toolName.toLowerCase())) {
        prefixMatches.push(renderer);
      }
    }

    if (prefixMatches.length > 0) {
      prefixMatches.sort((a, b) => {
        const lengthDiff = b.toolName.length - a.toolName.length;
        if (lengthDiff !== 0) return lengthDiff;
        const sourceDiff = SOURCE_ORDER[a.source] - SOURCE_ORDER[b.source];
        if (sourceDiff !== 0) return sourceDiff;
        return b.priority - a.priority;
      });
      return prefixMatches[0];
    }

    return undefined;
  }

  findIcon(toolName: string): React.ComponentType<{ className?: string }> | undefined {
    const normalized = toolName.toLowerCase();

    const exact = this.icons.get(`exact:${normalized}`);
    if (exact) return exact.icon;

    const prefixMatches: ToolIconContribution[] = [];
    for (const icon of this.icons.values()) {
      if (icon.matchType === "prefix" && normalized.startsWith(icon.toolName.toLowerCase())) {
        prefixMatches.push(icon);
      }
    }

    if (prefixMatches.length > 0) {
      prefixMatches.sort((a, b) => {
        const lengthDiff = b.toolName.length - a.toolName.length;
        if (lengthDiff !== 0) return lengthDiff;
        const sourceDiff = SOURCE_ORDER[a.source] - SOURCE_ORDER[b.source];
        if (sourceDiff !== 0) return sourceDiff;
        return b.priority - a.priority;
      });
      return prefixMatches[0].icon;
    }

    return undefined;
  }

  findMetadata(toolName: string): { displayName: string; description?: string } | undefined {
    const normalized = toolName.toLowerCase();

    const exact = this.metadata.get(`meta:${normalized}`);
    if (exact) return { displayName: exact.displayName, description: exact.description };

    const prefixMatches: ToolMetadataContribution[] = [];
    for (const meta of this.metadata.values()) {
      if (normalized.startsWith(meta.toolName.toLowerCase())) {
        prefixMatches.push(meta);
      }
    }

    if (prefixMatches.length > 0) {
      prefixMatches.sort((a, b) => {
        const lengthDiff = b.toolName.length - a.toolName.length;
        if (lengthDiff !== 0) return lengthDiff;
        const sourceDiff = SOURCE_ORDER[a.source] - SOURCE_ORDER[b.source];
        if (sourceDiff !== 0) return sourceDiff;
        return b.priority - a.priority;
      });
      return { displayName: prefixMatches[0].displayName, description: prefixMatches[0].description };
    }

    return undefined;
  }

  classifyTool(
    toolName: string,
    input: Record<string, unknown> | undefined,
    output: string | undefined,
    metadata: Record<string, unknown> | undefined,
  ): "expandable" | "static" | "standalone" {
    const normalized = toolName.toLowerCase();

    const exact = this.classifiers.get(`classifier:${normalized}`);
    if (exact) return exact.classify(toolName, input, output, metadata);

    for (const classifier of this.classifiers.values()) {
      if (normalized.startsWith(classifier.toolName.toLowerCase())) {
        return classifier.classify(toolName, input, output, metadata);
      }
    }

    return "expandable";
  }

  detectToolLanguage(
    toolName: string,
    output: string,
    input: Record<string, unknown> | undefined,
  ): string | undefined {
    const normalized = toolName.toLowerCase();

    const exact = this.languageDetectors.get(`lang:${normalized}`);
    if (exact) return exact.detectLanguage(toolName, output, input);

    for (const detector of this.languageDetectors.values()) {
      if (normalized.startsWith(detector.toolName.toLowerCase())) {
        return detector.detectLanguage(toolName, output, input);
      }
    }

    return undefined;
  }

  getSideEffectHint(toolName: string): string | undefined {
    const normalized = toolName.toLowerCase();

    const exact = this.sideEffectHints.get(`hint:${normalized}`);
    if (exact) return exact.hint;

    for (const hint of this.sideEffectHints.values()) {
      if (normalized.startsWith(hint.toolName.toLowerCase())) {
        return hint.hint;
      }
    }

    return undefined;
  }

  getAllRenderers(): ToolRendererContribution[] {
    return Array.from(this.renderers.values()).sort((a, b) => {
      const sourceDiff = SOURCE_ORDER[a.source] - SOURCE_ORDER[b.source];
      if (sourceDiff !== 0) return sourceDiff;
      return b.priority - a.priority;
    });
  }

  getAllIcons(): ToolIconContribution[] {
    return Array.from(this.icons.values()).sort((a, b) => {
      const sourceDiff = SOURCE_ORDER[a.source] - SOURCE_ORDER[b.source];
      if (sourceDiff !== 0) return sourceDiff;
      return b.priority - a.priority;
    });
  }

  getAllMetadata(): ToolMetadataContribution[] {
    return Array.from(this.metadata.values()).sort((a, b) => {
      const sourceDiff = SOURCE_ORDER[a.source] - SOURCE_ORDER[b.source];
      if (sourceDiff !== 0) return sourceDiff;
      return b.priority - a.priority;
    });
  }

  getAllClassifiers(): ToolClassifierContribution[] {
    return Array.from(this.classifiers.values()).sort((a, b) => {
      const sourceDiff = SOURCE_ORDER[a.source] - SOURCE_ORDER[b.source];
      if (sourceDiff !== 0) return sourceDiff;
      return b.priority - a.priority;
    });
  }

  getAllLanguageDetectors(): ToolLanguageDetectorContribution[] {
    return Array.from(this.languageDetectors.values()).sort((a, b) => {
      const sourceDiff = SOURCE_ORDER[a.source] - SOURCE_ORDER[b.source];
      if (sourceDiff !== 0) return sourceDiff;
      return b.priority - a.priority;
    });
  }

  getAllSideEffectHints(): ToolSideEffectHintContribution[] {
    return Array.from(this.sideEffectHints.values()).sort((a, b) => {
      const sourceDiff = SOURCE_ORDER[a.source] - SOURCE_ORDER[b.source];
      if (sourceDiff !== 0) return sourceDiff;
      return b.priority - a.priority;
    });
  }

  getAllRecords(): {
    renderers: ToolRendererContributionRecord[];
    icons: ToolIconContributionRecord[];
    metadata: ToolMetadataContributionRecord[];
    classifiers: ToolClassifierContributionRecord[];
    languageDetectors: ToolLanguageDetectorContributionRecord[];
    sideEffectHints: ToolSideEffectHintContributionRecord[];
  } {
    return {
      renderers: [...this.rendererRecords].sort((a, b) => {
        const sourceDiff = SOURCE_ORDER[a.source] - SOURCE_ORDER[b.source];
        if (sourceDiff !== 0) return sourceDiff;
        return b.priority - a.priority;
      }),
      icons: [...this.iconRecords].sort((a, b) => {
        const sourceDiff = SOURCE_ORDER[a.source] - SOURCE_ORDER[b.source];
        if (sourceDiff !== 0) return sourceDiff;
        return b.priority - a.priority;
      }),
      metadata: [...this.metadataRecords].sort((a, b) => {
        const sourceDiff = SOURCE_ORDER[a.source] - SOURCE_ORDER[b.source];
        if (sourceDiff !== 0) return sourceDiff;
        return b.priority - a.priority;
      }),
      classifiers: [...this.classifierRecords].sort((a, b) => {
        const sourceDiff = SOURCE_ORDER[a.source] - SOURCE_ORDER[b.source];
        if (sourceDiff !== 0) return sourceDiff;
        return b.priority - a.priority;
      }),
      languageDetectors: [...this.languageDetectorRecords].sort((a, b) => {
        const sourceDiff = SOURCE_ORDER[a.source] - SOURCE_ORDER[b.source];
        if (sourceDiff !== 0) return sourceDiff;
        return b.priority - a.priority;
      }),
      sideEffectHints: [...this.sideEffectHintRecords].sort((a, b) => {
        const sourceDiff = SOURCE_ORDER[a.source] - SOURCE_ORDER[b.source];
        if (sourceDiff !== 0) return sourceDiff;
        return b.priority - a.priority;
      }),
    };
  }

  getContributionCount(): number {
    return this.rendererRecords.length + this.iconRecords.length + this.metadataRecords.length
      + this.classifierRecords.length + this.languageDetectorRecords.length + this.sideEffectHintRecords.length;
  }
}
