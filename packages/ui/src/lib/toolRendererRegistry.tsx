import React from "react";
import {
  ToolRendererRegistry,
  type ToolPresentationClass,
  type ToolRendererComponent,
} from "@openchamber/plugin";
import { Icon } from "@/components/icon/Icon";
import { getToolMetadata as getToolMetadataFallback } from "@/lib/toolHelpers";
import {
  QuestionRenderer,
  TaskRenderer,
  EditRenderer,
  WriteRenderer,
  DefaultTextRenderer,
} from "@/components/chat/message/pluginToolRenderers";

let registry: ToolRendererRegistry | null = null;

function makeIcon(name: string): React.ComponentType<{ className?: string }> {
  return (props) => <Icon name={name} className={props.className} />;
}

function getToolIconFallback(toolName: string): React.ComponentType<{ className?: string }> {
  const tool = toolName.toLowerCase();

  if (tool === "edit" || tool === "multiedit" || tool === "apply_patch" || tool === "str_replace" || tool === "str_replace_based_edit_tool") {
    return makeIcon("pencil");
  }
  if (tool === "write" || tool === "create" || tool === "file_write") {
    return makeIcon("file-edit");
  }
  if (tool === "read" || tool === "view" || tool === "file_read" || tool === "cat") {
    return makeIcon("file-text");
  }
  if (tool === "bash" || tool === "shell" || tool === "cmd" || tool === "terminal") {
    return makeIcon("terminal-box");
  }
  if (tool === "list" || tool === "ls" || tool === "dir" || tool === "list_files") {
    return makeIcon("folder-6");
  }
  if (tool === "search" || tool === "grep" || tool === "find" || tool === "ripgrep") {
    return makeIcon("menu-search");
  }
  if (tool === "glob") {
    return makeIcon("file-search");
  }
  if (tool === "fetch" || tool === "curl" || tool === "wget" || tool === "webfetch") {
    return makeIcon("global");
  }
  if (
    tool === "web-search" ||
    tool === "websearch" ||
    tool === "search_web" ||
    tool === "codesearch" ||
    tool === "google" ||
    tool === "bing" ||
    tool === "duckduckgo" ||
    tool === "perplexity"
  ) {
    return makeIcon("global");
  }
  if (tool === "todowrite" || tool === "todoread") {
    return makeIcon("list-check-3");
  }
  if (tool === "structuredoutput" || tool === "structured_output") {
    return makeIcon("list-check-2");
  }
  if (tool === "skill") {
    return makeIcon("book");
  }
  if (tool === "task") {
    return makeIcon("ai-agent");
  }
  if (tool === "question") {
    return makeIcon("survey");
  }
  if (tool === "plan_enter") {
    return makeIcon("file-list-2");
  }
  if (tool === "plan_exit") {
    return makeIcon("task");
  }
  if (tool.startsWith("git")) {
    return makeIcon("git-branch");
  }
  return makeIcon("tools");
}

export function getToolRendererRegistry(): ToolRendererRegistry {
  if (!registry) {
    registry = new ToolRendererRegistry();

    // Register builtin icons
    const iconTools = [
      { name: "edit", icon: "pencil" },
      { name: "multiedit", icon: "pencil" },
      { name: "apply_patch", icon: "pencil" },
      { name: "str_replace", icon: "pencil" },
      { name: "write", icon: "file-edit" },
      { name: "create", icon: "file-edit" },
      { name: "file_write", icon: "file-edit" },
      { name: "read", icon: "file-text" },
      { name: "view", icon: "file-text" },
      { name: "file_read", icon: "file-text" },
      { name: "cat", icon: "file-text" },
      { name: "bash", icon: "terminal-box" },
      { name: "shell", icon: "terminal-box" },
      { name: "terminal", icon: "terminal-box" },
      { name: "list", icon: "folder-6" },
      { name: "ls", icon: "folder-6" },
      { name: "dir", icon: "folder-6" },
      { name: "list_files", icon: "folder-6" },
      { name: "search", icon: "menu-search" },
      { name: "grep", icon: "menu-search" },
      { name: "find", icon: "menu-search" },
      { name: "ripgrep", icon: "menu-search" },
      { name: "glob", icon: "file-search" },
      { name: "fetch", icon: "global" },
      { name: "curl", icon: "global" },
      { name: "wget", icon: "global" },
      { name: "webfetch", icon: "global" },
      { name: "web-search", icon: "global" },
      { name: "websearch", icon: "global" },
      { name: "search_web", icon: "global" },
      { name: "todowrite", icon: "list-check-3" },
      { name: "todoread", icon: "list-check-3" },
      { name: "structuredoutput", icon: "list-check-2" },
      { name: "structured_output", icon: "list-check-2" },
      { name: "skill", icon: "book" },
      { name: "task", icon: "ai-agent" },
      { name: "question", icon: "survey" },
      { name: "plan_enter", icon: "file-list-2" },
      { name: "plan_exit", icon: "task" },
    ];

    for (const { name, icon } of iconTools) {
      registry.registerIcon(name, { icon: makeIcon(icon), isCore: true }, "openchamber.core", "builtin");
    }

    // Register git prefix icon
    registry.registerIcon("git", { icon: makeIcon("git-branch"), matchType: "prefix", isCore: true }, "openchamber.core", "builtin");

    // Register metadata
    const metadataTools = [
      { name: "bash", displayName: "Bash" },
      { name: "edit", displayName: "Edit" },
      { name: "multiedit", displayName: "Multi Edit" },
      { name: "apply_patch", displayName: "Apply Patch" },
      { name: "write", displayName: "Write" },
      { name: "create", displayName: "Create" },
      { name: "read", displayName: "Read" },
      { name: "list", displayName: "List" },
      { name: "search", displayName: "Search" },
      { name: "grep", displayName: "Grep" },
      { name: "glob", displayName: "Glob" },
      { name: "fetch", displayName: "Fetch" },
      { name: "websearch", displayName: "Web Search" },
      { name: "web-search", displayName: "Web Search" },
      { name: "todowrite", displayName: "Todo Write" },
      { name: "todoread", displayName: "Todo Read" },
      { name: "task", displayName: "Task" },
      { name: "question", displayName: "Question" },
    ];

    for (const { name, displayName } of metadataTools) {
      registry.registerMetadata(name, { displayName, isCore: true }, "openchamber.core", "builtin");
    }

    // Register classifiers
    const classifyExpandable = () => "expandable" as ToolPresentationClass;
    const classifyStatic = () => "static" as ToolPresentationClass;
    const classifyStandalone = () => "standalone" as ToolPresentationClass;

    registry.registerClassifier("bash", { classify: classifyExpandable, isCore: true }, "openchamber.core", "builtin");
    registry.registerClassifier("edit", { classify: classifyExpandable, isCore: true }, "openchamber.core", "builtin");
    registry.registerClassifier("multiedit", { classify: classifyExpandable, isCore: true }, "openchamber.core", "builtin");
    registry.registerClassifier("apply_patch", { classify: classifyExpandable, isCore: true }, "openchamber.core", "builtin");
    registry.registerClassifier("write", { classify: classifyExpandable, isCore: true }, "openchamber.core", "builtin");
    registry.registerClassifier("create", { classify: classifyExpandable, isCore: true }, "openchamber.core", "builtin");
    registry.registerClassifier("read", { classify: classifyExpandable, isCore: true }, "openchamber.core", "builtin");
    registry.registerClassifier("list", { classify: classifyStatic, isCore: true }, "openchamber.core", "builtin");
    registry.registerClassifier("search", { classify: classifyStatic, isCore: true }, "openchamber.core", "builtin");
    registry.registerClassifier("grep", { classify: classifyStatic, isCore: true }, "openchamber.core", "builtin");
    registry.registerClassifier("glob", { classify: classifyStatic, isCore: true }, "openchamber.core", "builtin");
    registry.registerClassifier("todowrite", { classify: classifyStatic, isCore: true }, "openchamber.core", "builtin");
    registry.registerClassifier("todoread", { classify: classifyStatic, isCore: true }, "openchamber.core", "builtin");
    registry.registerClassifier("task", { classify: classifyStandalone, isCore: true }, "openchamber.core", "builtin");
    registry.registerClassifier("question", { classify: classifyStandalone, isCore: true }, "openchamber.core", "builtin");

    // Register side-effect hints
    registry.registerSideEffectHint("edit", { hint: "This will modify files on disk", isCore: true }, "openchamber.core", "builtin");
    registry.registerSideEffectHint("multiedit", { hint: "This will modify multiple files on disk", isCore: true }, "openchamber.core", "builtin");
    registry.registerSideEffectHint("apply_patch", { hint: "This will apply a patch to files", isCore: true }, "openchamber.core", "builtin");
    registry.registerSideEffectHint("write", { hint: "This will create or overwrite a file", isCore: true }, "openchamber.core", "builtin");
    registry.registerSideEffectHint("bash", { hint: "This will run a shell command", isCore: true }, "openchamber.core", "builtin");

    // Register renderers
    registry.registerRenderer("question", { render: QuestionRenderer as ToolRendererComponent, isCore: true }, "openchamber.core", "builtin");
    registry.registerRenderer("task", { render: TaskRenderer as ToolRendererComponent, isCore: true }, "openchamber.core", "builtin");
    registry.registerRenderer("edit", { render: EditRenderer as ToolRendererComponent, isCore: true }, "openchamber.core", "builtin");
    registry.registerRenderer("multiedit", { render: EditRenderer as ToolRendererComponent, isCore: true }, "openchamber.core", "builtin");
    registry.registerRenderer("apply_patch", { render: EditRenderer as ToolRendererComponent, isCore: true }, "openchamber.core", "builtin");
    registry.registerRenderer("write", { render: WriteRenderer as ToolRendererComponent, isCore: true }, "openchamber.core", "builtin");
    registry.registerRenderer("create", { render: WriteRenderer as ToolRendererComponent, isCore: true }, "openchamber.core", "builtin");
    registry.registerRenderer("file_write", { render: WriteRenderer as ToolRendererComponent, isCore: true }, "openchamber.core", "builtin");
    registry.registerRenderer("*", { render: DefaultTextRenderer as ToolRendererComponent, matchType: "wildcard", isCore: true }, "openchamber.core", "builtin");
  }

  return registry;
}

export function useToolRenderer(toolName: string) {
  const reg = getToolRendererRegistry();
  const renderer = reg.findRenderer(toolName);
  return renderer;
}

export function useToolIcon(toolName: string): React.ComponentType<{ className?: string }> {
  const reg = getToolRendererRegistry();
  const icon = reg.findIcon(toolName);
  return icon ?? getToolIconFallback(toolName);
}

export function useToolMetadata(toolName: string) {
  const reg = getToolRendererRegistry();
  const meta = reg.findMetadata(toolName);
  return meta ?? getToolMetadataFallback(toolName);
}

export function useToolClassification(
  toolName: string,
  input: Record<string, unknown> | undefined,
  output: string | undefined,
  metadata: Record<string, unknown> | undefined,
): ToolPresentationClass {
  const reg = getToolRendererRegistry();
  return reg.classifyTool(toolName, input, output, metadata);
}

export function useToolLanguageDetector(
  toolName: string,
  output: string,
  input: Record<string, unknown> | undefined,
): string | undefined {
  const reg = getToolRendererRegistry();
  return reg.detectToolLanguage(toolName, output, input);
}

export function useToolSideEffectHint(toolName: string): string | undefined {
  const reg = getToolRendererRegistry();
  return reg.getSideEffectHint(toolName);
}
