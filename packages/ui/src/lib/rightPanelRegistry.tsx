import React from "react";
import { RightPanelRegistry } from "@openchamber/plugin";
import { useI18n } from "@/lib/i18n";

let registry: RightPanelRegistry | null = null;

export function getRightPanelRegistry(): RightPanelRegistry {
  if (!registry) {
    registry = new RightPanelRegistry();
  }

  return registry;
}

export function useRightPanelTabs() {
  const { t } = useI18n();
  const reg = getRightPanelRegistry();

    const tabs = React.useMemo(() => {
      const allTabs = reg.getAllTabs();
      return allTabs.map((tab) => ({
        id: tab.tabId,
        label: tab.isCore ? (t(`layout.rightSidebar.${tab.tabId}` as never) || tab.label) : tab.label,
        icon: tab.icon ? React.createElement(tab.icon) : null,
      }));
    }, [reg, t]);

  return tabs;
}

export function renderRightPanelTab(tabId: string): React.ReactNode | null {
  const reg = getRightPanelRegistry();
  const tab = reg.getTab(tabId);
  if (!tab) return null;

  const RenderComponent = tab.render;
  return <RenderComponent />;
}
