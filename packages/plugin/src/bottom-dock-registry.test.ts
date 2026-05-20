import { describe, it, expect } from "vitest";
import { BottomDockRegistry } from "./bottom-dock-registry";

describe("BottomDockRegistry", () => {
  it("registers and retrieves a surface", () => {
    const reg = new BottomDockRegistry();
    const Component = () => null;
    reg.registerSurface(
      "terminal",
      { label: "Terminal", render: Component },
      "openchamber.core",
      "builtin",
    );

    const surface = reg.getSurface("terminal");
    expect(surface).toBeDefined();
    expect(surface?.label).toBe("Terminal");
    expect(surface?.surfaceId).toBe("terminal");
    expect(surface?.pluginId).toBe("openchamber.core");
  });

  it("throws on duplicate surface registration", () => {
    const reg = new BottomDockRegistry();
    const Component = () => null;
    reg.registerSurface(
      "terminal",
      { label: "Terminal", render: Component },
      "openchamber.core",
      "builtin",
    );

    expect(() => {
      reg.registerSurface(
        "terminal",
        { label: "Terminal 2", render: Component },
        "other.plugin",
        "user",
      );
    }).toThrow(/Duplicate bottom dock surface/);
  });

  it("returns surfaces sorted by source then priority", () => {
    const reg = new BottomDockRegistry();
    const C = () => null;

    reg.registerSurface("user-surface", { label: "User", render: C, priority: 10 }, "user.plugin", "user");
    reg.registerSurface("builtin-high", { label: "Builtin High", render: C, priority: 20 }, "openchamber.core", "builtin");
    reg.registerSurface("builtin-low", { label: "Builtin Low", render: C, priority: 5 }, "openchamber.core", "builtin");

    const surfaces = reg.getAllSuraces();
    expect(surfaces.map((s) => s.surfaceId)).toEqual(["builtin-low", "builtin-high", "user-surface"]);
  });

  it("filters surfaces by enabled features", () => {
    const reg = new BottomDockRegistry();
    const C = () => null;

    reg.registerSurface(
      "gated-surface",
      { label: "Gated", render: C, featureId: "openchamber.feature.experimental" },
      "openchamber.core",
      "builtin",
    );

    const withoutFeature = reg.getAllSuraces({ enabledFeatures: new Set() });
    expect(withoutFeature).toHaveLength(0);

    const withFeature = reg.getAllSuraces({ enabledFeatures: new Set(["openchamber.feature.experimental"]) });
    expect(withFeature).toHaveLength(1);
  });

  it("filters surfaces by enabled plugins", () => {
    const reg = new BottomDockRegistry();
    const C = () => null;

    reg.registerSurface("plugin-surface", { label: "Plugin", render: C }, "my.plugin", "user");

    const withoutPlugin = reg.getAllSuraces({ enabledPlugins: new Set() });
    expect(withoutPlugin).toHaveLength(0);

    const withPlugin = reg.getAllSuraces({ enabledPlugins: new Set(["my.plugin"]) });
    expect(withPlugin).toHaveLength(1);
  });

  it("returns fallback surface ID (core first, then any)", () => {
    const reg = new BottomDockRegistry();
    const C = () => null;

    reg.registerSurface("user-surface", { label: "User", render: C }, "user.plugin", "user");
    reg.registerSurface("core-surface", { label: "Core", render: C, isCore: true }, "openchamber.core", "builtin");

    expect(reg.getFallbackSurfaceId()).toBe("core-surface");

    const reg2 = new BottomDockRegistry();
    reg2.registerSurface("user-surface", { label: "User", render: C }, "user.plugin", "user");
    expect(reg2.getFallbackSurfaceId()).toBe("user-surface");

    const reg3 = new BottomDockRegistry();
    expect(reg3.getFallbackSurfaceId()).toBeUndefined();
  });

  it("sanitizes unknown surface ID to fallback", () => {
    const reg = new BottomDockRegistry();
    const C = () => null;

    reg.registerSurface("terminal", { label: "Terminal", render: C, isCore: true }, "openchamber.core", "builtin");

    expect(reg.sanitizeSurfaceId("terminal")).toBe("terminal");
    expect(reg.sanitizeSurfaceId("unknown")).toBe("terminal");
    expect(reg.sanitizeSurfaceId("")).toBe("terminal");
  });

  it("returns all records sorted", () => {
    const reg = new BottomDockRegistry();
    const C = () => null;

    reg.registerSurface("a", { label: "A", render: C }, "user.a", "user");
    reg.registerSurface("b", { label: "B", render: C }, "core.b", "builtin");

    const records = reg.getAllRecords();
    expect(records.map((r) => r.pluginId)).toEqual(["core.b", "user.a"]);
  });

  it("returns contribution count", () => {
    const reg = new BottomDockRegistry();
    const C = () => null;

    expect(reg.getContributionCount()).toBe(0);

    reg.registerSurface("a", { label: "A", render: C }, "core", "builtin");
    reg.registerSurface("b", { label: "B", render: C }, "core", "builtin");

    expect(reg.getContributionCount()).toBe(2);
  });
});
