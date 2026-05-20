import { describe, it, expect } from "vitest";
import { SettingsPageRegistry } from "./settings-registry";

describe("SettingsPageRegistry", () => {
  it("registers and retrieves a page", () => {
    const reg = new SettingsPageRegistry();
    reg.registerPage("test", {
      title: "Test Page",
      group: "general",
      kind: "single",
      renderContent: () => null,
    }, "test-plugin", "builtin");

    const page = reg.getPage("test");
    expect(page).toBeDefined();
    expect(page?.slug).toBe("test");
    expect(page?.title).toBe("Test Page");
    expect(page?.group).toBe("general");
    expect(page?.isCore).toBe(false);
  });

  it("throws on duplicate slug", () => {
    const reg = new SettingsPageRegistry();
    reg.registerPage("test", {
      title: "Test Page",
      group: "general",
      renderContent: () => null,
    }, "test-plugin", "builtin");

    expect(() => {
      reg.registerPage("test", {
        title: "Duplicate",
        group: "general",
        renderContent: () => null,
      }, "other-plugin", "builtin");
    }).toThrow(/Duplicate settings page slug/);
  });

  it("returns all pages sorted by source then priority", () => {
    const reg = new SettingsPageRegistry();
    reg.registerPage("user-page", {
      title: "User Page",
      group: "general",
      priority: 0,
      renderContent: () => null,
    }, "user-plugin", "user");
    reg.registerPage("builtin-page", {
      title: "Builtin Page",
      group: "general",
      priority: 10,
      renderContent: () => null,
    }, "builtin-plugin", "builtin");
    reg.registerPage("builtin-low", {
      title: "Builtin Low",
      group: "general",
      priority: 0,
      renderContent: () => null,
    }, "builtin-plugin", "builtin");

    const pages = reg.getAllPages();
    expect(pages).toHaveLength(3);
    expect(pages[0].slug).toBe("builtin-low");
    expect(pages[1].slug).toBe("builtin-page");
    expect(pages[2].slug).toBe("user-page");
  });

  it("filters by runtime context availability", () => {
    const reg = new SettingsPageRegistry();
    reg.registerPage("desktop-only", {
      title: "Desktop Only",
      group: "general",
      isAvailable: (ctx) => ctx.isDesktop,
      renderContent: () => null,
    }, "test-plugin", "builtin");
    reg.registerPage("always", {
      title: "Always",
      group: "general",
      renderContent: () => null,
    }, "test-plugin", "builtin");

    const webCtx = { isVSCode: false, isWeb: true, isDesktop: false };
    const desktopCtx = { isVSCode: false, isWeb: false, isDesktop: true };

    const webPages = reg.getAllPages({ runtimeContext: webCtx });
    expect(webPages).toHaveLength(1);
    expect(webPages[0].slug).toBe("always");

    const desktopPages = reg.getAllPages({ runtimeContext: desktopCtx });
    expect(desktopPages).toHaveLength(2);
  });

  it("filters by enabled features", () => {
    const reg = new SettingsPageRegistry();
    reg.registerPage("feature-page", {
      title: "Feature Page",
      group: "general",
      featureId: "test.feature",
      renderContent: () => null,
    }, "test-plugin", "builtin");
    reg.registerPage("no-feature", {
      title: "No Feature",
      group: "general",
      renderContent: () => null,
    }, "test-plugin", "builtin");

    const pages = reg.getAllPages({ enabledFeatures: new Set(["test.feature"]) });
    expect(pages).toHaveLength(2);

    const pagesWithoutFeature = reg.getAllPages({ enabledFeatures: new Set(["other.feature"]) });
    expect(pagesWithoutFeature).toHaveLength(1);
    expect(pagesWithoutFeature[0].slug).toBe("no-feature");
  });

  it("groups pages by group", () => {
    const reg = new SettingsPageRegistry();
    reg.registerPage("general-1", {
      title: "General 1",
      group: "general",
      renderContent: () => null,
    }, "test-plugin", "builtin");
    reg.registerPage("advanced-1", {
      title: "Advanced 1",
      group: "advanced",
      renderContent: () => null,
    }, "test-plugin", "builtin");

    const generalPages = reg.getPagesByGroup("general");
    expect(generalPages).toHaveLength(1);
    expect(generalPages[0].slug).toBe("general-1");

    const advancedPages = reg.getPagesByGroup("advanced");
    expect(advancedPages).toHaveLength(1);
    expect(advancedPages[0].slug).toBe("advanced-1");
  });

  it("tracks contribution records", () => {
    const reg = new SettingsPageRegistry();
    reg.registerPage("test", {
      title: "Test",
      group: "general",
      renderContent: () => null,
    }, "test-plugin", "builtin");

    const records = reg.getAllRecords();
    expect(records).toHaveLength(1);
    expect(records[0].slug).toBe("test");
    expect(records[0].pluginId).toBe("test-plugin");
    expect(reg.getContributionCount()).toBe(1);
  });

  it("supports split kind pages", () => {
    const reg = new SettingsPageRegistry();
    reg.registerPage("split-page", {
      title: "Split Page",
      group: "general",
      kind: "split",
      renderContent: () => null,
    }, "test-plugin", "builtin");

    const page = reg.getPage("split-page");
    expect(page?.kind).toBe("split");
  });
});
