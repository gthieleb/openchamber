import { describe, it, expect } from "vitest";
import { RUNTIME_CAPABILITY_DESCRIPTORS, hasCapability } from "./runtime-capabilities";
import { createPluginRuntimeFacade } from "./runtime-facade";
import type { PluginRuntimeAPIConfig, PluginRuntimeAPIs } from "./runtime-capabilities";

describe("RuntimeCapabilityDescriptors", () => {
  it("covers all major capability namespaces", () => {
    const namespaces = new Set(RUNTIME_CAPABILITY_DESCRIPTORS.map((d) => d.capability.split(".")[0]));
    expect(namespaces.has("fs")).toBe(true);
    expect(namespaces.has("git")).toBe(true);
    expect(namespaces.has("terminal")).toBe(true);
    expect(namespaces.has("settings")).toBe(true);
    expect(namespaces.has("notifications")).toBe(true);
    expect(namespaces.has("github")).toBe(true);
    expect(namespaces.has("editor")).toBe(true);
    expect(namespaces.has("vscode")).toBe(true);
    expect(namespaces.has("diagnostics")).toBe(true);
    expect(namespaces.has("push")).toBe(true);
  });

  it("marks write and exec capabilities as dangerous", () => {
    const dangerous = RUNTIME_CAPABILITY_DESCRIPTORS.filter((d) => d.dangerous);
    const dangerousIds = dangerous.map((d) => d.capability);
    expect(dangerousIds).toContain("fs.write");
    expect(dangerousIds).toContain("fs.exec");
    expect(dangerousIds).toContain("git.write");
    expect(dangerousIds).toContain("terminal");
    expect(dangerousIds).toContain("settings.write");
  });

  it("has non-empty API lists for each descriptor", () => {
    for (const desc of RUNTIME_CAPABILITY_DESCRIPTORS) {
      expect(desc.apis.length).toBeGreaterThan(0);
    }
  });
});

describe("hasCapability", () => {
  const baseConfig = (granted: string[], denied: string[] = []): PluginRuntimeAPIConfig => ({
    grantedCapabilities: granted as PluginRuntimeAPIConfig["grantedCapabilities"],
    deniedCapabilities: denied as PluginRuntimeAPIConfig["deniedCapabilities"],
    source: "builtin",
    pluginId: "test-plugin",
  });

  it("returns true when capability is granted and not denied", () => {
    const config = baseConfig(["fs.read"]);
    expect(hasCapability(config, "fs.read")).toBe(true);
  });

  it("returns false when capability is not granted", () => {
    const config = baseConfig(["fs.read"]);
    expect(hasCapability(config, "fs.write")).toBe(false);
  });

  it("returns false when capability is denied even if granted", () => {
    const config = baseConfig(["fs.read", "fs.write"], ["fs.write"]);
    expect(hasCapability(config, "fs.write")).toBe(false);
  });
});

describe("createPluginRuntimeFacade", () => {
  function makeConfig(granted: string[], denied: string[] = []): PluginRuntimeAPIConfig {
    return {
      grantedCapabilities: granted as PluginRuntimeAPIConfig["grantedCapabilities"],
      deniedCapabilities: denied as PluginRuntimeAPIConfig["deniedCapabilities"],
      source: "builtin",
      pluginId: "test-plugin",
    };
  }

  it("exposes granted APIs", () => {
    const runtime: PluginRuntimeAPIs = {
      files: {
        readFile: async () => "content",
        writeFile: async () => undefined,
      },
      git: {},
      terminal: {},
      settings: {},
      notifications: {},
    };
    const config = makeConfig(["fs.read"]);
    const facade = createPluginRuntimeFacade(runtime, config);

    expect(typeof facade.files?.readFile).toBe("function");
    expect(facade.files?.writeFile).toBeDefined();
  });

  it("throws when calling denied API", () => {
    const runtime: PluginRuntimeAPIs = {
      files: {
        readFile: async () => "content",
        writeFile: async () => undefined,
      },
      git: {},
      terminal: {},
      settings: {},
      notifications: {},
    };
    const config = makeConfig(["fs.read"]);
    const facade = createPluginRuntimeFacade(runtime, config);

    expect(() => {
      facade.files?.writeFile?.("/tmp/test", "data");
    }).toThrow(/does not have capability/);
  });

  it("preserves function binding for granted APIs", async () => {
    const calls: string[] = [];
    const runtime: PluginRuntimeAPIs = {
      files: {
        readFile: async (path: string) => {
          calls.push(path);
          return `content of ${path}`;
        },
      },
      git: {},
      terminal: {},
      settings: {},
      notifications: {},
    };
    const config = makeConfig(["fs.read"]);
    const facade = createPluginRuntimeFacade(runtime, config);

    const result = await facade.files?.readFile?.("/tmp/test");
    expect(result).toBe("content of /tmp/test");
    expect(calls).toContain("/tmp/test");
  });

  it("handles undefined namespace gracefully", () => {
    const runtime: PluginRuntimeAPIs = {
      files: {},
      git: {},
      terminal: {},
      settings: {},
      notifications: {},
    };
    const config = makeConfig(["github"]);
    const facade = createPluginRuntimeFacade(runtime, config);

    expect(facade.github).toBeUndefined();
  });

  it("wraps optional namespaces when present", () => {
    const runtime: PluginRuntimeAPIs = {
      files: {},
      git: {},
      terminal: {},
      settings: {},
      notifications: {},
      editor: {
        openFile: async () => {},
      },
    };
    const config = makeConfig(["editor"]);
    const facade = createPluginRuntimeFacade(runtime, config);

    expect(typeof facade.editor?.openFile).toBe("function");
  });

  it("blocks denied capability even when granted", () => {
    const runtime: PluginRuntimeAPIs = {
      files: {
        readFile: async () => "content",
        writeFile: async () => undefined,
      },
      git: {},
      terminal: {},
      settings: {},
      notifications: {},
    };
    const config = makeConfig(["fs.read", "fs.write"], ["fs.write"]);
    const facade = createPluginRuntimeFacade(runtime, config);

    expect(() => {
      facade.files?.writeFile?.("/tmp/test", "data");
    }).toThrow(/does not have capability/);
  });
});
