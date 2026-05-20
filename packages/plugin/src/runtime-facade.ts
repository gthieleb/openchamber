import type { PluginRuntimeAPIs, PluginRuntimeAPIConfig, RuntimeCapability } from "./runtime-capabilities";
import { hasCapability, RUNTIME_CAPABILITY_DESCRIPTORS } from "./runtime-capabilities";

const METHOD_TO_CAPABILITY = new Map<string, RuntimeCapability>();
for (const desc of RUNTIME_CAPABILITY_DESCRIPTORS) {
  for (const api of desc.apis) {
    METHOD_TO_CAPABILITY.set(api, desc.capability);
  }
}

function wrapMethod<T extends (...args: unknown[]) => unknown>(
  config: PluginRuntimeAPIConfig,
  method: string,
  fn: T,
): T {
  const capability = METHOD_TO_CAPABILITY.get(method);
  if (capability && !hasCapability(config, capability)) {
    return (() => {
      throw new Error(`Plugin "${config.pluginId}" does not have capability "${capability}"`);
    }) as unknown as T;
  }
  return fn;
}

function wrapNamespace<T extends Record<string, unknown>>(
  config: PluginRuntimeAPIConfig,
  namespace: string,
  target: T | undefined,
): T {
  if (!target) return {} as T;
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(target)) {
    const method = `${namespace}.${key}`;
    if (typeof value === "function") {
      result[key] = wrapMethod(config, method, value as (...args: unknown[]) => unknown);
    } else {
      result[key] = value;
    }
  }
  return result as T;
}

export function createPluginRuntimeFacade(
  runtime: PluginRuntimeAPIs,
  config: PluginRuntimeAPIConfig,
): PluginRuntimeAPIs {
  return {
    files: wrapNamespace(config, "files", runtime.files),
    git: wrapNamespace(config, "git", runtime.git),
    terminal: wrapNamespace(config, "terminal", runtime.terminal),
    settings: wrapNamespace(config, "settings", runtime.settings),
    notifications: wrapNamespace(config, "notifications", runtime.notifications),
    github: runtime.github ? wrapNamespace(config, "github", runtime.github) : undefined,
    editor: runtime.editor ? wrapNamespace(config, "editor", runtime.editor) : undefined,
    vscode: runtime.vscode ? wrapNamespace(config, "vscode", runtime.vscode) : undefined,
    diagnostics: runtime.diagnostics ? wrapNamespace(config, "diagnostics", runtime.diagnostics) : undefined,
    push: runtime.push ? wrapNamespace(config, "push", runtime.push) : undefined,
  };
}
