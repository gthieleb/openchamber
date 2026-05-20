import type {
  AuthProviderConfig,
  AuthProviderContribution,
  AuthProviderContributionRecord,
  AuthProviderDescriptor,
  AuthProviderSnapshot,
} from "./auth-provider-types";

export class AuthProviderRegistry {
  private providers = new Map<string, AuthProviderContribution>();
  private records: AuthProviderContributionRecord[] = [];

  registerProvider(config: AuthProviderConfig, pluginId: string, source: string): void {
    if (this.providers.has(config.id)) {
      throw new Error(`Duplicate auth provider ID: "${config.id}" (plugin: "${pluginId}", existing: "${this.providers.get(config.id)?.pluginId}")`);
    }

    const contribution: AuthProviderContribution = {
      id: config.id,
      label: config.label,
      description: config.description,
      type: config.type,
      icon: config.icon,
      priority: config.priority ?? 0,
      enabled: config.enabled !== false,
      loginComponent: config.loginComponent,
      callbackComponent: config.callbackComponent,
      supportsTrustDevice: config.supportsTrustDevice ?? false,
      isAvailable: config.isAvailable ?? (() => true),
      pluginId,
      source,
    };

    this.providers.set(config.id, contribution);
    this.records.push({
      id: config.id,
      pluginId,
      source,
      type: config.type,
      enabled: contribution.enabled,
    });
  }

  getProvider(id: string): AuthProviderContribution | undefined {
    return this.providers.get(id);
  }

  getAllProviders(): AuthProviderContribution[] {
    return Array.from(this.providers.values())
      .filter((p) => p.enabled)
      .sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
  }

  getAvailableProviders(): AuthProviderContribution[] {
    return this.getAllProviders().filter((p) => p.isAvailable());
  }

  getDescriptors(): AuthProviderDescriptor[] {
    return this.getAvailableProviders().map((p) => ({
      id: p.id,
      label: p.label,
      description: p.description,
      type: p.type,
      icon: p.icon,
      priority: p.priority,
      supportsTrustDevice: p.supportsTrustDevice,
    }));
  }

  getSnapshot(): AuthProviderSnapshot {
    const providers = this.getDescriptors();
    return {
      providers,
      enabledCount: providers.length,
    };
  }

  hasProvider(id: string): boolean {
    return this.providers.has(id);
  }

  getContributionCount(): number {
    return this.records.length;
  }

  getAllRecords(): AuthProviderContributionRecord[] {
    return [...this.records];
  }

  clear(): void {
    this.providers.clear();
    this.records = [];
  }
}
