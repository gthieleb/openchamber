import React from "react";
import { ContextPanelRendererRegistry } from "@openchamber/plugin";
import { Icon } from "@/components/icon/Icon";
import { lazyWithChunkRecovery } from "@/lib/chunkLoadRecovery";

const DiffView = lazyWithChunkRecovery(() => import("@/components/views/DiffView").then((m) => ({ default: m.DiffView })));
const FilesView = lazyWithChunkRecovery(() => import("@/components/views/FilesView").then((m) => ({ default: m.FilesView })));
const PlanView = lazyWithChunkRecovery(() => import("@/components/views/PlanView").then((m) => ({ default: m.PlanView })));

let registry: ContextPanelRendererRegistry | null = null;

export function getContextPanelRendererRegistry(): ContextPanelRendererRegistry {
  if (!registry) {
    registry = new ContextPanelRendererRegistry();

    registry.registerRenderer("diff", {
      label: "Diff",
      icon: () => <Icon name="git-commit" className="h-3.5 w-3.5" />,
      render: DiffView as React.ComponentType<unknown>,
      priority: 0,
      isCore: true,
    }, "openchamber.core", "builtin");

    registry.registerRenderer("file", {
      label: "File",
      icon: () => <Icon name="file-text" className="h-3.5 w-3.5" />,
      render: FilesView as React.ComponentType<unknown>,
      priority: 10,
      isCore: true,
    }, "openchamber.core", "builtin");

    registry.registerRenderer("context", {
      label: "Context",
      icon: () => <Icon name="booklet" className="h-3.5 w-3.5" />,
      render: React.lazy(() => import("@/components/layout/ContextSidebarTab").then((m) => ({ default: m.ContextPanelContent }))) as React.ComponentType<unknown>,
      priority: 20,
      isCore: true,
    }, "openchamber.core", "builtin");

    registry.registerRenderer("plan", {
      label: "Plan",
      icon: () => <Icon name="layout-list" className="h-3.5 w-3.5" />,
      render: PlanView as React.ComponentType<unknown>,
      priority: 30,
      isCore: true,
    }, "openchamber.core", "builtin");
  }

  return registry;
}

export function renderContextPanelMode(mode: string, props?: { targetPath?: string | null; readOnly?: boolean }): React.ReactNode | null {
  const reg = getContextPanelRendererRegistry();
  const renderer = reg.getRenderer(mode);
  if (!renderer) return null;

  const RenderComponent = renderer.render as React.ComponentType<Record<string, unknown>>;

  if (mode === "diff") {
    return <RenderComponent hideStackedFileSidebar stackedDefaultCollapsedAll hideFileSelector pinSelectedFileHeaderToTopOnNavigate showOpenInEditorAction />;
  }

  if (mode === "file") {
    return <RenderComponent mode="editor-only" />;
  }

  if (mode === "plan") {
    return <RenderComponent targetPath={props?.targetPath ?? undefined} />;
  }

  return <RenderComponent />;
}
