import { PluginStorageRegistry, getQuotaForScope } from "@openchamber/plugin";

let registry: PluginStorageRegistry | null = null;
const globalStores = new Map<string, Map<string, unknown>>();
const workspaceStores = new Map<string, Map<string, Map<string, unknown>>>();

export function getPluginStorageRegistry(): PluginStorageRegistry {
  if (!registry) {
    registry = new PluginStorageRegistry();
  }
  return registry;
}

function getGlobalStore(pluginId: string): Map<string, unknown> {
  if (!globalStores.has(pluginId)) {
    globalStores.set(pluginId, new Map());
  }
  return globalStores.get(pluginId)!;
}

function getWorkspaceStore(pluginId: string, workspaceId: string): Map<string, unknown> {
  if (!workspaceStores.has(workspaceId)) {
    workspaceStores.set(workspaceId, new Map());
  }
  const workspaceMap = workspaceStores.get(workspaceId)!;
  if (!workspaceMap.has(pluginId)) {
    workspaceMap.set(pluginId, new Map());
  }
  return workspaceMap.get(pluginId)!;
}

function estimateSize(value: unknown): number {
  try {
    return new Blob([JSON.stringify(value)]).size;
  } catch {
    return 0;
  }
}

function checkQuota(store: Map<string, unknown>, quota: { maxEntries: number; maxBytes: number }, pluginId: string): void {
  if (store.size >= quota.maxEntries) {
    throw new Error(`Plugin "${pluginId}" exceeded max entries quota (${quota.maxEntries})`);
  }

  let totalBytes = 0;
  for (const [, value] of store) {
    totalBytes += estimateSize(value);
  }
  if (totalBytes >= quota.maxBytes) {
    throw new Error(`Plugin "${pluginId}" exceeded max bytes quota (${quota.maxBytes})`);
  }
}

export function createPluginStorage(pluginId: string) {
  const reg = getPluginStorageRegistry();
  const config = reg.getStorageConfig(pluginId);
  const scope = config?.scope ?? "global";
  const quota = config?.quota ?? getQuotaForScope(scope);

  return {
    get<T>(key: string): T | undefined {
      const store = scope === "global"
        ? getGlobalStore(pluginId)
        : getWorkspaceStore(pluginId, "default");
      return store.get(key) as T | undefined;
    },

    set<T>(key: string, value: T): void {
      const store = scope === "global"
        ? getGlobalStore(pluginId)
        : getWorkspaceStore(pluginId, "default");

      checkQuota(store, quota, pluginId);
      store.set(key, value);
    },

    delete(key: string): void {
      const store = scope === "global"
        ? getGlobalStore(pluginId)
        : getWorkspaceStore(pluginId, "default");
      store.delete(key);
    },

    keys(): string[] {
      const store = scope === "global"
        ? getGlobalStore(pluginId)
        : getWorkspaceStore(pluginId, "default");
      return Array.from(store.keys());
    },

    clear(): void {
      const store = scope === "global"
        ? getGlobalStore(pluginId)
        : getWorkspaceStore(pluginId, "default");
      store.clear();
    },

    size(): number {
      const store = scope === "global"
        ? getGlobalStore(pluginId)
        : getWorkspaceStore(pluginId, "default");
      return store.size;
    },
  };
}

export function cleanupPluginStorage(pluginId: string): void {
  globalStores.delete(pluginId);
  for (const [, workspaceMap] of workspaceStores) {
    workspaceMap.delete(pluginId);
  }
  const reg = getPluginStorageRegistry();
  reg.unregisterPlugin(pluginId);
}
