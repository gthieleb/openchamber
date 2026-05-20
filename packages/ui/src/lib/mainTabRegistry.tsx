import React from "react";
import { MainTabRegistry } from "@openchamber/plugin";

let registry: MainTabRegistry | null = null;

export function getMainTabRegistry(): MainTabRegistry {
  if (!registry) {
    registry = new MainTabRegistry();
  }

  return registry;
}

export function renderMainTab(tabId: string): React.ReactNode | null {
  const reg = getMainTabRegistry();
  const tab = reg.getTab(tabId);
  if (!tab) return null;

  const RenderComponent = tab.render;
  return (
    <React.Suspense fallback={null}>
      <RenderComponent />
    </React.Suspense>
  );
}
