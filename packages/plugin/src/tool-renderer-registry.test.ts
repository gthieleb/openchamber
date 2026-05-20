import { describe, it, expect } from "vitest";
import { ToolRendererRegistry } from "./tool-renderer-registry";

describe("ToolRendererRegistry", () => {
  it("registers and finds an exact renderer", () => {
    const reg = new ToolRendererRegistry();
    const MockRenderer = () => null;
    reg.registerRenderer("bash", { render: MockRenderer }, "test-plugin", "builtin");

    const renderer = reg.findRenderer("bash");
    expect(renderer).toBeDefined();
    expect(renderer?.toolName).toBe("bash");
    expect(renderer?.matchType).toBe("exact");
    expect(renderer?.render).toBe(MockRenderer);
  });

  it("finds prefix renderer", () => {
    const reg = new ToolRendererRegistry();
    const MockRenderer = () => null;
    reg.registerRenderer("git", { render: MockRenderer, matchType: "prefix" }, "test-plugin", "builtin");

    const renderer = reg.findRenderer("git.commit");
    expect(renderer).toBeDefined();
    expect(renderer?.toolName).toBe("git");
    expect(renderer?.matchType).toBe("prefix");

    const noMatch = reg.findRenderer("bash");
    expect(noMatch).toBeUndefined();
  });

  it("prefers exact over prefix", () => {
    const reg = new ToolRendererRegistry();
    const ExactRenderer = () => null;
    const PrefixRenderer = () => null;
    reg.registerRenderer("bash", { render: ExactRenderer }, "test-plugin", "builtin");
    reg.registerRenderer("bash", { render: PrefixRenderer, matchType: "prefix" }, "other-plugin", "builtin");

    const renderer = reg.findRenderer("bash");
    expect(renderer?.render).toBe(ExactRenderer);
  });

  it("throws on duplicate renderer", () => {
    const reg = new ToolRendererRegistry();
    reg.registerRenderer("bash", { render: () => null }, "test-plugin", "builtin");

    expect(() => {
      reg.registerRenderer("bash", { render: () => null }, "other-plugin", "builtin");
    }).toThrow(/Duplicate tool renderer/);
  });

  it("registers and finds an icon", () => {
    const reg = new ToolRendererRegistry();
    const MockIcon = () => null;
    reg.registerIcon("bash", { icon: MockIcon }, "test-plugin", "builtin");

    const icon = reg.findIcon("bash");
    expect(icon).toBe(MockIcon);
  });

  it("finds prefix icon", () => {
    const reg = new ToolRendererRegistry();
    const MockIcon = () => null;
    reg.registerIcon("git", { icon: MockIcon, matchType: "prefix" }, "test-plugin", "builtin");

    const icon = reg.findIcon("git.commit");
    expect(icon).toBe(MockIcon);
  });

  it("registers and finds metadata", () => {
    const reg = new ToolRendererRegistry();
    reg.registerMetadata("bash", { displayName: "Bash", description: "Run shell commands" }, "test-plugin", "builtin");

    const meta = reg.findMetadata("bash");
    expect(meta).toBeDefined();
    expect(meta?.displayName).toBe("Bash");
    expect(meta?.description).toBe("Run shell commands");
  });

  it("returns all renderers sorted", () => {
    const reg = new ToolRendererRegistry();
    reg.registerRenderer("user-tool", { render: () => null, priority: 0 }, "user-plugin", "user");
    reg.registerRenderer("builtin-tool", { render: () => null, priority: 10 }, "builtin-plugin", "builtin");
    reg.registerRenderer("builtin-low", { render: () => null, priority: 0 }, "builtin-plugin", "builtin");

    const renderers = reg.getAllRenderers();
    expect(renderers).toHaveLength(3);
    expect(renderers[0].toolName).toBe("builtin-tool");
    expect(renderers[1].toolName).toBe("builtin-low");
    expect(renderers[2].toolName).toBe("user-tool");
  });

  it("tracks contribution records", () => {
    const reg = new ToolRendererRegistry();
    reg.registerRenderer("bash", { render: () => null }, "test-plugin", "builtin");
    reg.registerIcon("bash", { icon: () => null }, "test-plugin", "builtin");
    reg.registerMetadata("bash", { displayName: "Bash" }, "test-plugin", "builtin");

    const records = reg.getAllRecords();
    expect(records.renderers).toHaveLength(1);
    expect(records.icons).toHaveLength(1);
    expect(records.metadata).toHaveLength(1);
    expect(reg.getContributionCount()).toBe(3);
  });

  it("returns undefined for unknown tool", () => {
    const reg = new ToolRendererRegistry();

    expect(reg.findRenderer("unknown")).toBeUndefined();
    expect(reg.findIcon("unknown")).toBeUndefined();
    expect(reg.findMetadata("unknown")).toBeUndefined();
  });

  it("normalizes tool name to lowercase", () => {
    const reg = new ToolRendererRegistry();
    const MockRenderer = () => null;
    reg.registerRenderer("Bash", { render: MockRenderer }, "test-plugin", "builtin");

    const renderer = reg.findRenderer("BASH");
    expect(renderer).toBeDefined();
    expect(renderer?.toolName).toBe("Bash");
  });

  it("selects longest prefix match", () => {
    const reg = new ToolRendererRegistry();
    const ShortRenderer = () => null;
    const LongRenderer = () => null;
    reg.registerRenderer("git", { render: ShortRenderer, matchType: "prefix" }, "plugin-a", "builtin");
    reg.registerRenderer("git.commit", { render: LongRenderer, matchType: "prefix" }, "plugin-b", "builtin");

    const renderer = reg.findRenderer("git.commit.message");
    expect(renderer?.toolName).toBe("git.commit");
    expect(renderer?.render).toBe(LongRenderer);
  });

  it("classifies tools with registered classifier", () => {
    const reg = new ToolRendererRegistry();
    reg.registerClassifier("bash", {
      classify: () => "static",
    }, "test-plugin", "builtin");

    expect(reg.classifyTool("bash", undefined, undefined, undefined)).toBe("static");
  });

  it("returns default expandable for unclassified tools", () => {
    const reg = new ToolRendererRegistry();
    expect(reg.classifyTool("unknown", undefined, undefined, undefined)).toBe("expandable");
  });

  it("detects tool language with registered detector", () => {
    const reg = new ToolRendererRegistry();
    reg.registerLanguageDetector("bash", {
      detectLanguage: () => "bash",
    }, "test-plugin", "builtin");

    expect(reg.detectToolLanguage("bash", "echo hello", undefined)).toBe("bash");
  });

  it("returns undefined for unregistered language detector", () => {
    const reg = new ToolRendererRegistry();
    expect(reg.detectToolLanguage("unknown", "output", undefined)).toBeUndefined();
  });

  it("returns side-effect hint", () => {
    const reg = new ToolRendererRegistry();
    reg.registerSideEffectHint("edit", {
      hint: "This will modify files on disk",
    }, "test-plugin", "builtin");

    expect(reg.getSideEffectHint("edit")).toBe("This will modify files on disk");
  });

  it("returns undefined for unregistered side-effect hint", () => {
    const reg = new ToolRendererRegistry();
    expect(reg.getSideEffectHint("unknown")).toBeUndefined();
  });

  it("tracks all contribution types in count", () => {
    const reg = new ToolRendererRegistry();
    reg.registerRenderer("bash", { render: () => null }, "test-plugin", "builtin");
    reg.registerIcon("bash", { icon: () => null }, "test-plugin", "builtin");
    reg.registerMetadata("bash", { displayName: "Bash" }, "test-plugin", "builtin");
    reg.registerClassifier("bash", { classify: () => "static" }, "test-plugin", "builtin");
    reg.registerLanguageDetector("bash", { detectLanguage: () => "bash" }, "test-plugin", "builtin");
    reg.registerSideEffectHint("bash", { hint: "Runs commands" }, "test-plugin", "builtin");

    expect(reg.getContributionCount()).toBe(6);
  });

  it("returns all records for all contribution types", () => {
    const reg = new ToolRendererRegistry();
    reg.registerRenderer("bash", { render: () => null }, "test-plugin", "builtin");
    reg.registerClassifier("bash", { classify: () => "static" }, "test-plugin", "builtin");

    const records = reg.getAllRecords();
    expect(records.renderers).toHaveLength(1);
    expect(records.classifiers).toHaveLength(1);
    expect(records.languageDetectors).toHaveLength(0);
    expect(records.sideEffectHints).toHaveLength(0);
  });
});
