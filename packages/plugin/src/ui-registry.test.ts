import { describe, it, expect } from "vitest";
import { UIContributionRegistry } from "./ui-registry";

function DummyComponent() {
  return null;
}

describe("UIContributionRegistry", () => {
  describe("fill", () => {
    it("registers and retrieves fills for a slot", () => {
      const registry = new UIContributionRegistry();

      registry.registerFill("toolbar.actions", DummyComponent, "test.plugin", "builtin");

      const fills = registry.getFillsForSlot("toolbar.actions");
      expect(fills).toHaveLength(1);
      expect(fills[0].slotId).toBe("toolbar.actions");
    });

    it("returns empty array for unknown slot", () => {
      const registry = new UIContributionRegistry();

      const fills = registry.getFillsForSlot("unknown.slot");
      expect(fills).toHaveLength(0);
    });

    it("sorts fills by priority (higher first)", () => {
      const registry = new UIContributionRegistry();

      registry.registerFill("toolbar.actions", DummyComponent, "test.low", "builtin", { priority: 10 });
      registry.registerFill("toolbar.actions", DummyComponent, "test.high", "builtin", { priority: 100 });

      const fills = registry.getFillsForSlot("toolbar.actions");
      expect(fills[0].pluginId).toBe("test.high");
      expect(fills[1].pluginId).toBe("test.low");
    });

    it("filters fills by enabled features", () => {
      const registry = new UIContributionRegistry();

      registry.registerFill("toolbar.actions", DummyComponent, "test.plugin", "builtin", {
        featureId: "openchamber.feature.terminal",
      });

      const enabled = registry.getFillsForSlot("toolbar.actions", {
        enabledFeatures: new Set(["openchamber.feature.terminal"]),
      });
      expect(enabled).toHaveLength(1);

      const disabled = registry.getFillsForSlot("toolbar.actions", {
        enabledFeatures: new Set(),
      });
      expect(disabled).toHaveLength(0);
    });

    it("fills without featureId are always included", () => {
      const registry = new UIContributionRegistry();

      registry.registerFill("toolbar.actions", DummyComponent, "test.plugin", "builtin");

      const fills = registry.getFillsForSlot("toolbar.actions", {
        enabledFeatures: new Set(),
      });
      expect(fills).toHaveLength(1);
    });
  });

  describe("surface", () => {
    it("registers and retrieves a surface", () => {
      const registry = new UIContributionRegistry();

      registry.registerSurface("terminal.shell", {
        title: "Terminal",
        placements: ["workbench.main", "workbench.bottom-dock"],
        render: DummyComponent,
      }, "test.plugin", "builtin");

      const surface = registry.getSurface("terminal.shell");
      expect(surface).toBeDefined();
      expect(surface?.title).toBe("Terminal");
    });

    it("throws on duplicate surface ID", () => {
      const registry = new UIContributionRegistry();

      registry.registerSurface("terminal.shell", {
        title: "Terminal",
        placements: ["workbench.main"],
        render: DummyComponent,
      }, "test.plugin", "builtin");

      expect(() => {
        registry.registerSurface("terminal.shell", {
          title: "Terminal 2",
          placements: ["workbench.main"],
          render: DummyComponent,
        }, "test.plugin2", "builtin");
      }).toThrow('Duplicate surface ID: "terminal.shell"');
    });

    it("returns surfaces for a placement", () => {
      const registry = new UIContributionRegistry();

      registry.registerSurface("terminal.shell", {
        title: "Terminal",
        placements: ["workbench.main", "workbench.bottom-dock"],
        render: DummyComponent,
      }, "test.plugin", "builtin");

      registry.registerSurface("files.view", {
        title: "Files",
        placements: ["workbench.main"],
        render: DummyComponent,
      }, "test.plugin", "builtin");

      const mainSurfaces = registry.getSurfacesForPlacement("workbench.main");
      expect(mainSurfaces).toHaveLength(2);

      const dockSurfaces = registry.getSurfacesForPlacement("workbench.bottom-dock");
      expect(dockSurfaces).toHaveLength(1);
      expect(dockSurfaces[0].surfaceId).toBe("terminal.shell");
    });

    it("filters surfaces by enabled features", () => {
      const registry = new UIContributionRegistry();

      registry.registerSurface("terminal.shell", {
        title: "Terminal",
        placements: ["workbench.main"],
        render: DummyComponent,
        featureId: "openchamber.feature.terminal",
      }, "test.plugin", "builtin");

      const enabled = registry.getSurfacesForPlacement("workbench.main", {
        enabledFeatures: new Set(["openchamber.feature.terminal"]),
      });
      expect(enabled).toHaveLength(1);

      const disabled = registry.getSurfacesForPlacement("workbench.main", {
        enabledFeatures: new Set(),
      });
      expect(disabled).toHaveLength(0);
    });
  });

  describe("replace", () => {
    it("registers and retrieves a replacement", () => {
      const registry = new UIContributionRegistry();

      registry.registerReplace("workbench.right-panel", DummyComponent, "test.plugin", "builtin");

      const replacement = registry.getActiveReplace("workbench.right-panel");
      expect(replacement).toBeDefined();
      expect(replacement?.targetId).toBe("workbench.right-panel");
    });

    it("returns undefined for no replacements", () => {
      const registry = new UIContributionRegistry();

      const replacement = registry.getActiveReplace("unknown.target");
      expect(replacement).toBeUndefined();
    });

    it("tracks replacement conflicts", () => {
      const registry = new UIContributionRegistry();

      registry.registerReplace("workbench.right-panel", DummyComponent, "test.plugin-a", "builtin");
      registry.registerReplace("workbench.right-panel", DummyComponent, "test.plugin-b", "builtin");

      const conflicts = registry.getReplacementConflicts();
      expect(conflicts.has("workbench.right-panel")).toBe(true);
      expect(conflicts.get("workbench.right-panel")).toEqual(["test.plugin-a", "test.plugin-b"]);
    });

    it("selects replacement by selectedPluginId", () => {
      const registry = new UIContributionRegistry();

      registry.registerReplace("workbench.right-panel", DummyComponent, "test.plugin-a", "builtin");
      registry.registerReplace("workbench.right-panel", DummyComponent, "test.plugin-b", "builtin");

      const selected = registry.getActiveReplace("workbench.right-panel", {
        selectedPluginId: "test.plugin-b",
      });
      expect(selected?.pluginId).toBe("test.plugin-b");
    });

    it("filters replacements by enabled features", () => {
      const registry = new UIContributionRegistry();

      registry.registerReplace("workbench.right-panel", DummyComponent, "test.plugin", "builtin", {
        featureId: "openchamber.feature.git",
      });

      const enabled = registry.getActiveReplace("workbench.right-panel", {
        enabledFeatures: new Set(["openchamber.feature.git"]),
      });
      expect(enabled).toBeDefined();

      const disabled = registry.getActiveReplace("workbench.right-panel", {
        enabledFeatures: new Set(),
      });
      expect(disabled).toBeUndefined();
    });
  });

  describe("wrap", () => {
    it("registers and retrieves wraps for a target", () => {
      const registry = new UIContributionRegistry();

      const wrapper = ({ children }: { children: React.ReactNode }) => children;
      registry.registerWrap("workbench.left-sidebar", wrapper, "test.plugin", "builtin");

      const wraps = registry.getWrapsForTarget("workbench.left-sidebar");
      expect(wraps).toHaveLength(1);
      expect(wraps[0].targetId).toBe("workbench.left-sidebar");
    });

    it("returns empty array for unknown target", () => {
      const registry = new UIContributionRegistry();

      const wraps = registry.getWrapsForTarget("unknown.target");
      expect(wraps).toHaveLength(0);
    });

    it("sorts wraps by priority (higher first)", () => {
      const registry = new UIContributionRegistry();

      const wrapper = ({ children }: { children: React.ReactNode }) => children;
      registry.registerWrap("workbench.left-sidebar", wrapper, "test.low", "builtin", { priority: 10 });
      registry.registerWrap("workbench.left-sidebar", wrapper, "test.high", "builtin", { priority: 100 });

      const wraps = registry.getWrapsForTarget("workbench.left-sidebar");
      expect(wraps[0].pluginId).toBe("test.high");
      expect(wraps[1].pluginId).toBe("test.low");
    });

    it("filters wraps by enabled features", () => {
      const registry = new UIContributionRegistry();

      const wrapper = ({ children }: { children: React.ReactNode }) => children;
      registry.registerWrap("workbench.left-sidebar", wrapper, "test.plugin", "builtin", {
        featureId: "openchamber.feature.git",
      });

      const enabled = registry.getWrapsForTarget("workbench.left-sidebar", {
        enabledFeatures: new Set(["openchamber.feature.git"]),
      });
      expect(enabled).toHaveLength(1);

      const disabled = registry.getWrapsForTarget("workbench.left-sidebar", {
        enabledFeatures: new Set(),
      });
      expect(disabled).toHaveLength(0);
    });
  });

  describe("contribution tracking", () => {
    it("tracks all contributions", () => {
      const registry = new UIContributionRegistry();

      registry.registerFill("toolbar.actions", DummyComponent, "test.plugin", "builtin");
      registry.registerSurface("terminal.shell", {
        title: "Terminal",
        placements: ["workbench.main"],
        render: DummyComponent,
      }, "test.plugin", "builtin");

      const contributions = registry.getAllContributions();
      expect(contributions).toHaveLength(2);
    });

    it("returns contribution count", () => {
      const registry = new UIContributionRegistry();

      registry.registerFill("toolbar.actions", DummyComponent, "test.plugin", "builtin");

      expect(registry.getContributionCount()).toBe(1);
    });
  });
});
