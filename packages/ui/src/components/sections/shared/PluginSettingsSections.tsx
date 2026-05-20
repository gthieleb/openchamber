import React from "react";
import { SettingsSection } from "@/components/sections/shared/SettingsSection";
import { useSettingsSections } from "@/lib/settingsSectionRegistry";
import type { SettingsRuntimeContext } from "@openchamber/plugin";

interface PluginSettingsSectionsProps {
  pageSlug: string;
  runtimeCtx: SettingsRuntimeContext;
}

export const PluginSettingsSections: React.FC<PluginSettingsSectionsProps> = ({
  pageSlug,
  runtimeCtx,
}) => {
  const sections = useSettingsSections(pageSlug, runtimeCtx);

  if (sections.length === 0) return null;

  return (
    <>
      {sections.map((section) => {
        const ContentComponent = section.renderContent;
        return (
          <SettingsSection
            key={`${section.pageSlug}:${section.sectionId}`}
            title={section.title}
            description={section.description}
            divider
          >
            <ContentComponent />
          </SettingsSection>
        );
      })}
    </>
  );
};
