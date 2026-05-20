import React from "react";
import { SettingsSectionRegistry, type SettingsRuntimeContext } from "@openchamber/plugin";

let registry: SettingsSectionRegistry | null = null;

export function getSettingsSectionRegistry(): SettingsSectionRegistry {
  if (!registry) {
    registry = new SettingsSectionRegistry();
  }
  return registry;
}

export function useSettingsSections(
  pageSlug: string,
  runtimeCtx: SettingsRuntimeContext,
) {
  const reg = getSettingsSectionRegistry();

  const sections = React.useMemo(() => {
    return reg.getSectionsForPage(pageSlug, { runtimeContext: runtimeCtx });
  }, [reg, pageSlug, runtimeCtx]);

  return sections;
}
