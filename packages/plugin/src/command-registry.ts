import type { PluginSource } from "./types";
import type { CommandContribution, CommandConfig, CommandContributionRecord } from "./command-types";

const SOURCE_ORDER: Record<PluginSource, number> = {
  builtin: 0,
  bundled: 1,
  user: 2,
};

export class CommandRegistry {
  private commands = new Map<string, CommandContribution>();
  private records: CommandContributionRecord[] = [];

  registerCommand(
    id: string,
    config: CommandConfig,
    pluginId: string,
    source: PluginSource,
  ): void {
    if (this.commands.has(id)) {
      throw new Error(`Duplicate command ID: "${id}"`);
    }

    const contribution: CommandContribution = {
      type: "command",
      id,
      title: config.title,
      group: config.group,
      icon: config.icon,
      shortcutId: config.shortcutId,
      keywords: config.keywords,
      isAvailable: config.isAvailable,
      run: config.run,
      pluginId,
      source,
      priority: config.priority ?? 0,
      featureId: config.featureId,
      isCore: config.isCore ?? false,
    };

    this.commands.set(id, contribution);
    this.records.push({
      id,
      pluginId,
      source,
      priority: contribution.priority,
      data: contribution,
    });
  }

  getCommand(id: string): CommandContribution | undefined {
    return this.commands.get(id);
  }

  getAllCommands(
    filters?: {
      enabledFeatures?: Set<string>;
      enabledPlugins?: Set<string>;
    },
  ): CommandContribution[] {
    let commands = Array.from(this.commands.values());

    commands = commands.filter((c) => !c.isAvailable || c.isAvailable());

    if (filters?.enabledFeatures) {
      commands = commands.filter(
        (c) => !c.featureId || filters.enabledFeatures!.has(c.featureId),
      );
    }

    if (filters?.enabledPlugins) {
      commands = commands.filter((c) => filters.enabledPlugins!.has(c.pluginId));
    }

    return [...commands].sort((a, b) => {
      const sourceDiff = SOURCE_ORDER[a.source] - SOURCE_ORDER[b.source];
      if (sourceDiff !== 0) return sourceDiff;
      return a.priority - b.priority;
    });
  }

  hasCommand(id: string): boolean {
    return this.commands.has(id);
  }

  getCommandsByGroup(
    group: string,
    filters?: {
      enabledFeatures?: Set<string>;
      enabledPlugins?: Set<string>;
    },
  ): CommandContribution[] {
    return this.getAllCommands(filters).filter((c) => c.group === group);
  }

  executeCommand(id: string): void | Promise<void> {
    const command = this.commands.get(id);
    if (!command) {
      throw new Error(`Command not found: "${id}"`);
    }
    return command.run();
  }

  getAllRecords(): CommandContributionRecord[] {
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
