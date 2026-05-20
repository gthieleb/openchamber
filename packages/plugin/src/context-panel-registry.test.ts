import { describe, it, expect } from "vitest";
import { ContextPanelRendererRegistry } from "./context-panel-registry";

function createMockComponent() {
  return function MockComponent() {
    return null;
  };
}

describe("ContextPanelRendererRegistry", () => {
  it("registers and retrieves renderers", () => {
    const registry = new ContextPanelRendererRegistry();

    registry.registerRenderer("diff", {
      label: "Diff",
      render: createMockComponent(),
      isCore: true,
    }, "test.diff", "builtin");

    const renderer = registry.getRenderer("diff");
    expect(renderer).toBeDefined();
    expect(renderer?.mode).toBe("diff");
    expect(renderer?.label).toBe("Diff");
  });

  it("throws on duplicate mode", () => {
    const registry = new ContextPanelRendererRegistry();

    registry.registerRenderer("diff", {
      label: "Diff",
      render: createMockComponent(),
    }, "test.diff", "builtin");

    expect(() => {
      registry.registerRenderer("diff", {
        label: "Diff 2",
        render: createMockComponent(),
      }, "test.diff2", "builtin");
    }).toThrow(/Duplicate context panel renderer mode/);
  });

  it("returns all renderers sorted by source and priority", () => {
    const registry = new ContextPanelRendererRegistry();

    registry.registerRenderer("file", {
      label: "File",
      render: createMockComponent(),
      priority: 10,
    }, "test.file", "builtin");

    registry.registerRenderer("diff", {
      label: "Diff",
      render: createMockComponent(),
      priority: 0,
    }, "test.diff", "builtin");

    registry.registerRenderer("plan", {
      label: "Plan",
      render: createMockComponent(),
      priority: 5,
    }, "test.plan", "user");

    const renderers = registry.getAllRenderers();
    expect(renderers.map((r) => r.mode)).toEqual(["diff", "file", "plan"]);
  });

  it("filters renderers by enabled features", () => {
    const registry = new ContextPanelRendererRegistry();

    registry.registerRenderer("diff", {
      label: "Diff",
      render: createMockComponent(),
      featureId: "openchamber.feature.diff",
    }, "test.diff", "builtin");

    registry.registerRenderer("file", {
      label: "File",
      render: createMockComponent(),
    }, "test.file", "builtin");

    const withDiff = registry.getAllRenderers({ enabledFeatures: new Set(["openchamber.feature.diff"]) });
    expect(withDiff.map((r) => r.mode)).toContain("diff");

    const withoutDiff = registry.getAllRenderers({ enabledFeatures: new Set() });
    expect(withoutDiff.map((r) => r.mode)).not.toContain("diff");
  });

  it("checks renderer validity", () => {
    const registry = new ContextPanelRendererRegistry();

    registry.registerRenderer("diff", {
      label: "Diff",
      render: createMockComponent(),
    }, "test.diff", "builtin");

    expect(registry.isValidMode("diff")).toBe(true);
    expect(registry.isValidMode("unknown")).toBe(false);
    expect(registry.hasRenderer("diff")).toBe(true);
  });

  it("tracks contribution records", () => {
    const registry = new ContextPanelRendererRegistry();

    registry.registerRenderer("diff", {
      label: "Diff",
      render: createMockComponent(),
    }, "test.diff", "builtin");

    registry.registerRenderer("file", {
      label: "File",
      render: createMockComponent(),
    }, "test.file", "builtin");

    expect(registry.getContributionCount()).toBe(2);
    expect(registry.getAllRecords()).toHaveLength(2);
  });
});
