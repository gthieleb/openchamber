import { describe, it, expect } from "vitest";
import { RightPanelRegistry } from "./right-panel-registry";

function createMockComponent() {
  return function MockComponent() {
    return null;
  };
}

describe("RightPanelRegistry", () => {
  it("registers and retrieves tabs", () => {
    const registry = new RightPanelRegistry();

    registry.registerTab("git", {
      label: "Git",
      render: createMockComponent(),
      isCore: true,
    }, "test.git", "builtin");

    const tab = registry.getTab("git");
    expect(tab).toBeDefined();
    expect(tab?.tabId).toBe("git");
    expect(tab?.label).toBe("Git");
  });

  it("throws on duplicate tab ID", () => {
    const registry = new RightPanelRegistry();

    registry.registerTab("git", {
      label: "Git",
      render: createMockComponent(),
    }, "test.git", "builtin");

    expect(() => {
      registry.registerTab("git", {
        label: "Git 2",
        render: createMockComponent(),
      }, "test.git2", "builtin");
    }).toThrow(/Duplicate right panel tab ID/);
  });

  it("returns all tabs sorted by source and priority", () => {
    const registry = new RightPanelRegistry();

    registry.registerTab("context", {
      label: "Context",
      render: createMockComponent(),
      priority: 20,
    }, "test.context", "builtin");

    registry.registerTab("git", {
      label: "Git",
      render: createMockComponent(),
      priority: 0,
    }, "test.git", "builtin");

    registry.registerTab("files", {
      label: "Files",
      render: createMockComponent(),
      priority: 10,
    }, "test.files", "user");

    const tabs = registry.getAllTabs();
    expect(tabs.map((t) => t.tabId)).toEqual(["git", "context", "files"]);
  });

  it("filters tabs by enabled features", () => {
    const registry = new RightPanelRegistry();

    registry.registerTab("git", {
      label: "Git",
      render: createMockComponent(),
      featureId: "openchamber.feature.git",
    }, "test.git", "builtin");

    registry.registerTab("files", {
      label: "Files",
      render: createMockComponent(),
    }, "test.files", "builtin");

    const withGit = registry.getAllTabs({ enabledFeatures: new Set(["openchamber.feature.git"]) });
    expect(withGit.map((t) => t.tabId)).toContain("git");

    const withoutGit = registry.getAllTabs({ enabledFeatures: new Set() });
    expect(withoutGit.map((t) => t.tabId)).not.toContain("git");
  });

  it("returns fallback tab ID", () => {
    const registry = new RightPanelRegistry();

    registry.registerTab("files", {
      label: "Files",
      render: createMockComponent(),
      priority: 10,
    }, "test.files", "builtin");

    registry.registerTab("git", {
      label: "Git",
      render: createMockComponent(),
      priority: 0,
      isCore: true,
    }, "test.git", "builtin");

    expect(registry.getFallbackTabId()).toBe("git");
  });

  it("sanitizes unknown tab IDs to fallback", () => {
    const registry = new RightPanelRegistry();

    registry.registerTab("git", {
      label: "Git",
      render: createMockComponent(),
      isCore: true,
    }, "test.git", "builtin");

    expect(registry.sanitizeTabId("git")).toBe("git");
    expect(registry.sanitizeTabId("unknown_tab")).toBe("git");
  });

  it("tracks contribution records", () => {
    const registry = new RightPanelRegistry();

    registry.registerTab("git", {
      label: "Git",
      render: createMockComponent(),
    }, "test.git", "builtin");

    expect(registry.getContributionCount()).toBe(1);
  });
});
