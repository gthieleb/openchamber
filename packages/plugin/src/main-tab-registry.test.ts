import { describe, it, expect } from "vitest";
import { MainTabRegistry } from "./main-tab-registry";

function createMockComponent() {
  return function MockComponent() {
    return null;
  };
}

describe("MainTabRegistry", () => {
  it("registers and retrieves tabs", () => {
    const registry = new MainTabRegistry();

    registry.registerTab("chat", {
      label: "Chat",
      render: createMockComponent(),
      isCore: true,
      priority: 0,
    }, "test.plugin", "builtin");

    const tab = registry.getTab("chat");
    expect(tab).toBeDefined();
    expect(tab?.tabId).toBe("chat");
    expect(tab?.label).toBe("Chat");
    expect(tab?.isCore).toBe(true);
  });

  it("throws on duplicate tab ID", () => {
    const registry = new MainTabRegistry();

    registry.registerTab("chat", {
      label: "Chat",
      render: createMockComponent(),
    }, "test.plugin", "builtin");

    expect(() => {
      registry.registerTab("chat", {
        label: "Chat 2",
        render: createMockComponent(),
      }, "test.plugin2", "builtin");
    }).toThrow(/Duplicate main tab ID/);
  });

  it("returns all tabs sorted by source and priority", () => {
    const registry = new MainTabRegistry();

    registry.registerTab("files", {
      label: "Files",
      render: createMockComponent(),
      priority: 10,
    }, "test.files", "builtin");

    registry.registerTab("chat", {
      label: "Chat",
      render: createMockComponent(),
      priority: 0,
    }, "test.chat", "builtin");

    registry.registerTab("terminal", {
      label: "Terminal",
      render: createMockComponent(),
      priority: 5,
    }, "test.terminal", "user");

    const tabs = registry.getAllTabs();
    expect(tabs.map((t) => t.tabId)).toEqual(["chat", "files", "terminal"]);
  });

  it("filters tabs by enabled features", () => {
    const registry = new MainTabRegistry();

    registry.registerTab("chat", {
      label: "Chat",
      render: createMockComponent(),
    }, "test.chat", "builtin");

    registry.registerTab("git", {
      label: "Git",
      render: createMockComponent(),
      featureId: "openchamber.feature.git",
    }, "test.git", "builtin");

    const withGit = registry.getAllTabs({ enabledFeatures: new Set(["openchamber.feature.git"]) });
    expect(withGit.map((t) => t.tabId)).toContain("git");

    const withoutGit = registry.getAllTabs({ enabledFeatures: new Set() });
    expect(withoutGit.map((t) => t.tabId)).not.toContain("git");
  });

  it("filters tabs by enabled plugins", () => {
    const registry = new MainTabRegistry();

    registry.registerTab("chat", {
      label: "Chat",
      render: createMockComponent(),
    }, "test.chat", "builtin");

    registry.registerTab("terminal", {
      label: "Terminal",
      render: createMockComponent(),
    }, "test.terminal", "builtin");

    const tabs = registry.getAllTabs({ enabledPlugins: new Set(["test.chat"]) });
    expect(tabs.map((t) => t.tabId)).toEqual(["chat"]);
  });

  it("returns fallback tab ID (core first, then by priority)", () => {
    const registry = new MainTabRegistry();

    registry.registerTab("files", {
      label: "Files",
      render: createMockComponent(),
      priority: 10,
    }, "test.files", "builtin");

    registry.registerTab("chat", {
      label: "Chat",
      render: createMockComponent(),
      priority: 0,
      isCore: true,
    }, "test.chat", "builtin");

    expect(registry.getFallbackTabId()).toBe("chat");
  });

  it("sanitizes unknown tab IDs to fallback", () => {
    const registry = new MainTabRegistry();

    registry.registerTab("chat", {
      label: "Chat",
      render: createMockComponent(),
      isCore: true,
    }, "test.chat", "builtin");

    expect(registry.sanitizeTabId("chat")).toBe("chat");
    expect(registry.sanitizeTabId("unknown_tab")).toBe("chat");
  });

  it("returns undefined sanitization when no tabs registered", () => {
    const registry = new MainTabRegistry();
    expect(registry.sanitizeTabId("anything")).toBeUndefined();
  });

  it("tracks contribution records", () => {
    const registry = new MainTabRegistry();

    registry.registerTab("chat", {
      label: "Chat",
      render: createMockComponent(),
    }, "test.chat", "builtin");

    registry.registerTab("files", {
      label: "Files",
      render: createMockComponent(),
    }, "test.files", "builtin");

    expect(registry.getContributionCount()).toBe(2);
    expect(registry.getAllRecords()).toHaveLength(2);
  });

  it("checks tab validity", () => {
    const registry = new MainTabRegistry();

    registry.registerTab("chat", {
      label: "Chat",
      render: createMockComponent(),
    }, "test.chat", "builtin");

    expect(registry.isValidTabId("chat")).toBe(true);
    expect(registry.isValidTabId("unknown")).toBe(false);
    expect(registry.hasTab("chat")).toBe(true);
  });
});
