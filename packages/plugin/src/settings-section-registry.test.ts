import { describe, it, expect } from "vitest";
import { SettingsSectionRegistry } from "./settings-section-registry";

describe("SettingsSectionRegistry", () => {
  it("registers and retrieves a section", () => {
    const reg = new SettingsSectionRegistry();
    const Component = () => null;
    reg.registerSection(
      "appearance",
      "theme-extension",
      { title: "Theme Extension", renderContent: Component },
      "openchamber.core",
      "builtin",
    );

    const section = reg.getSection("appearance", "theme-extension");
    expect(section).toBeDefined();
    expect(section?.title).toBe("Theme Extension");
    expect(section?.pageSlug).toBe("appearance");
    expect(section?.pluginId).toBe("openchamber.core");
  });

  it("throws on duplicate section registration", () => {
    const reg = new SettingsSectionRegistry();
    const Component = () => null;
    reg.registerSection(
      "appearance",
      "theme-extension",
      { title: "Theme Extension", renderContent: Component },
      "openchamber.core",
      "builtin",
    );

    expect(() => {
      reg.registerSection(
        "appearance",
        "theme-extension",
        { title: "Duplicate", renderContent: Component },
        "other.plugin",
        "user",
      );
    }).toThrow(/Duplicate settings section/);
  });

  it("returns sections for a page sorted by source then priority", () => {
    const reg = new SettingsSectionRegistry();
    const C = () => null;

    reg.registerSection("chat", "section-c", { title: "C", renderContent: C, priority: 10 }, "user.plugin", "user");
    reg.registerSection("chat", "section-a", { title: "A", renderContent: C, priority: 5 }, "openchamber.core", "builtin");
    reg.registerSection("chat", "section-b", { title: "B", renderContent: C, priority: 1 }, "openchamber.core", "builtin");

    const sections = reg.getSectionsForPage("chat");
    expect(sections.map((s) => s.sectionId)).toEqual(["section-b", "section-a", "section-c"]);
  });

  it("filters sections by runtime context", () => {
    const reg = new SettingsSectionRegistry();
    const C = () => null;

    reg.registerSection(
      "chat",
      "desktop-only",
      {
        title: "Desktop Only",
        renderContent: C,
        isAvailable: (ctx) => ctx.isDesktop,
      },
      "openchamber.core",
      "builtin",
    );

    const webSections = reg.getSectionsForPage("chat", { runtimeContext: { isVSCode: false, isWeb: true, isDesktop: false } });
    expect(webSections).toHaveLength(0);

    const desktopSections = reg.getSectionsForPage("chat", { runtimeContext: { isVSCode: false, isWeb: false, isDesktop: true } });
    expect(desktopSections).toHaveLength(1);
  });

  it("filters sections by enabled features", () => {
    const reg = new SettingsSectionRegistry();
    const C = () => null;

    reg.registerSection(
      "chat",
      "gated-section",
      { title: "Gated", renderContent: C, featureId: "openchamber.feature.experimental" },
      "openchamber.core",
      "builtin",
    );

    const withoutFeature = reg.getSectionsForPage("chat", { enabledFeatures: new Set() });
    expect(withoutFeature).toHaveLength(0);

    const withFeature = reg.getSectionsForPage("chat", { enabledFeatures: new Set(["openchamber.feature.experimental"]) });
    expect(withFeature).toHaveLength(1);
  });

  it("filters sections by enabled plugins", () => {
    const reg = new SettingsSectionRegistry();
    const C = () => null;

    reg.registerSection("chat", "plugin-section", { title: "Plugin Section", renderContent: C }, "my.plugin", "user");

    const withoutPlugin = reg.getSectionsForPage("chat", { enabledPlugins: new Set() });
    expect(withoutPlugin).toHaveLength(0);

    const withPlugin = reg.getSectionsForPage("chat", { enabledPlugins: new Set(["my.plugin"]) });
    expect(withPlugin).toHaveLength(1);
  });

  it("returns all records sorted", () => {
    const reg = new SettingsSectionRegistry();
    const C = () => null;

    reg.registerSection("chat", "a", { title: "A", renderContent: C }, "user.a", "user");
    reg.registerSection("chat", "b", { title: "B", renderContent: C }, "core.b", "builtin");

    const records = reg.getAllRecords();
    expect(records.map((r) => r.pluginId)).toEqual(["core.b", "user.a"]);
  });

  it("returns contribution count", () => {
    const reg = new SettingsSectionRegistry();
    const C = () => null;

    expect(reg.getContributionCount()).toBe(0);

    reg.registerSection("chat", "a", { title: "A", renderContent: C }, "core", "builtin");
    reg.registerSection("chat", "b", { title: "B", renderContent: C }, "core", "builtin");

    expect(reg.getContributionCount()).toBe(2);
  });

  it("allows same section ID on different pages", () => {
    const reg = new SettingsSectionRegistry();
    const C = () => null;

    reg.registerSection("chat", "shared-section", { title: "Chat Section", renderContent: C }, "core", "builtin");
    reg.registerSection("appearance", "shared-section", { title: "Appearance Section", renderContent: C }, "core", "builtin");

    expect(reg.getSection("chat", "shared-section")?.title).toBe("Chat Section");
    expect(reg.getSection("appearance", "shared-section")?.title).toBe("Appearance Section");
    expect(reg.getContributionCount()).toBe(2);
  });
});
