import { describe, it, expect } from "vitest";
import { loadBundledUIPlugins, getBundledUIDiagnostics } from "./bundled-plugin-loader";
import type { BundledPluginPackage } from "./bundled-plugin-types";
import type { PluginRegistry } from "./registry";
import type { FeatureRegistry } from "./feature-registry";

const mockRegistry = {} as unknown as PluginRegistry;
const mockFeatureRegistry = {} as unknown as FeatureRegistry;

describe("loadBundledUIPlugins", () => {
  it("loads UI plugins from packages", async () => {
    const setupFn = () => {};
    const packages: BundledPluginPackage[] = [
      {
        manifest: {
          id: "test.ui-plugin",
          name: "Test UI Plugin",
          version: "1.0.0",
          source: "bundled",
          targets: ["ui"],
          capabilities: [],
          optionalCapabilities: [],
          priority: 0,
          required: false,
          enabledByDefault: true,
          entry: "./test-ui.ts",
        },
        uiEntry: async () => ({ default: setupFn }),
      },
    ];

    const loaded = await loadBundledUIPlugins(mockRegistry, mockFeatureRegistry, packages);
    expect(loaded).toHaveLength(1);
    expect(loaded[0].manifest.id).toBe("test.ui-plugin");
    expect(loaded[0].setup).toBe(setupFn);
  });

  it("skips packages without UI entry", async () => {
    const packages: BundledPluginPackage[] = [
      {
        manifest: {
          id: "test.server-only",
          name: "Test Server Plugin",
          version: "1.0.0",
          source: "bundled",
          targets: ["server"],
          capabilities: [],
          optionalCapabilities: [],
          priority: 0,
          required: false,
          enabledByDefault: true,
          entry: "./test-server.js",
        },
      },
    ];

    const loaded = await loadBundledUIPlugins(mockRegistry, mockFeatureRegistry, packages);
    expect(loaded).toHaveLength(0);
  });

  it("handles load errors gracefully", async () => {
    const packages: BundledPluginPackage[] = [
      {
        manifest: {
          id: "test.broken",
          name: "Test Broken Plugin",
          version: "1.0.0",
          source: "bundled",
          targets: ["ui"],
          capabilities: [],
          optionalCapabilities: [],
          priority: 0,
          required: false,
          enabledByDefault: true,
          entry: "./broken.ts",
        },
        uiEntry: async () => {
          throw new Error("Load failed");
        },
      },
    ];

    const loaded = await loadBundledUIPlugins(mockRegistry, mockFeatureRegistry, packages);
    expect(loaded).toHaveLength(0);
  });
});

describe("getBundledUIDiagnostics", () => {
  it("returns diagnostics for UI packages", () => {
    const packages: BundledPluginPackage[] = [
      {
        manifest: {
          id: "test.ui-plugin",
          name: "Test UI Plugin",
          version: "1.0.0",
          source: "bundled",
          targets: ["ui"],
          capabilities: [],
          optionalCapabilities: [],
          priority: 0,
          required: false,
          enabledByDefault: true,
          entry: "./test-ui.ts",
        },
        uiEntry: async () => ({ default: () => {} }),
      },
      {
        manifest: {
          id: "test.server-only",
          name: "Test Server Plugin",
          version: "1.0.0",
          source: "bundled",
          targets: ["server"],
          capabilities: [],
          optionalCapabilities: [],
          priority: 0,
          required: false,
          enabledByDefault: true,
          entry: "./test-server.js",
        },
      },
    ];

    const diagnostics = getBundledUIDiagnostics(packages);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].id).toBe("test.ui-plugin");
    expect(diagnostics[0].source).toBe("bundled");
    expect(diagnostics[0].hasEntry).toBe(true);
  });

  it("shows disabled state for disabled plugins", () => {
    const packages: BundledPluginPackage[] = [
      {
        manifest: {
          id: "test.disabled",
          name: "Test Disabled Plugin",
          version: "1.0.0",
          source: "bundled",
          targets: ["ui"],
          capabilities: [],
          optionalCapabilities: [],
          priority: 0,
          required: false,
          enabledByDefault: false,
          entry: "./test-ui.ts",
        },
        uiEntry: async () => ({ default: () => {} }),
      },
    ];

    const diagnostics = getBundledUIDiagnostics(packages);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].enabled).toBe(false);
  });
});
