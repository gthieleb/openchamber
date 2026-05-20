import React from 'react';
import { OpenChamberVisualSettings } from './OpenChamberVisualSettings';
import { AboutSettings } from './AboutSettings';
import { SessionRetentionSettings } from './SessionRetentionSettings';
import { PasskeySettings } from './PasskeySettings';
import { DefaultsSettings } from './DefaultsSettings';
import { GitSettings } from './GitSettings';
import { NotificationSettings } from './NotificationSettings';
import { GitHubSettings } from './GitHubSettings';
import { VoiceSettings } from './VoiceSettings';
import { TunnelSettings } from './TunnelSettings';
import { OpenCodeCliSettings } from './OpenCodeCliSettings';
import { DesktopNetworkSettings } from './DesktopNetworkSettings';
import { KeyboardShortcutsSettings } from './KeyboardShortcutsSettings';
import { ScrollableOverlay } from '@/components/ui/ScrollableOverlay';
import { PluginSettingsSections } from '@/components/sections/shared/PluginSettingsSections';
import { useDeviceInfo } from '@/lib/device';
import { isDesktopLocalOriginActive, isDesktopShell, isVSCodeRuntime, isWebRuntime } from '@/lib/desktop';
import type { OpenChamberSection } from './types';
import type { SettingsRuntimeContext } from '@openchamber/plugin';

interface OpenChamberPageProps {
    /** Which section to display. If undefined, shows all sections (mobile/legacy behavior) */
    section?: OpenChamberSection;
}

export const OpenChamberPage: React.FC<OpenChamberPageProps> = ({ section }) => {
    const { isMobile } = useDeviceInfo();
    const showAbout = isMobile && isWebRuntime();
    const isVSCode = isVSCodeRuntime();
    const showDesktopNetworkSettings = isDesktopShell() && isDesktopLocalOriginActive();

    const runtimeCtx: SettingsRuntimeContext = React.useMemo(() => ({
        isVSCode,
        isWeb: isWebRuntime(),
        isDesktop: isDesktopShell(),
    }), [isVSCode]);

    // If no section specified, show all (mobile/legacy behavior)
    if (!section) {
        return (
            <ScrollableOverlay
                outerClassName="h-full"
                className="w-full"
            >
                <div className="openchamber-page-body mx-auto max-w-3xl space-y-3 p-3 sm:space-y-6 sm:p-6 sm:pt-8">
                    <OpenChamberVisualSettings />
                    <div className="border-t border-border/40 pt-6">
                        <DefaultsSettings />
                    </div>
                    {!isVSCode && (
                        <div className="border-t border-border/40 pt-6">
                            <OpenCodeCliSettings />
                        </div>
                    )}
                    {showDesktopNetworkSettings && (
                        <div className="border-t border-border/40 pt-6">
                            <DesktopNetworkSettings />
                        </div>
                    )}
                    <div className="border-t border-border/40 pt-6">
                        <SessionRetentionSettings />
                    </div>
                    <div className="border-t border-border/40 pt-6">
                        <PasskeySettings />
                    </div>
                    {showAbout && (
                        <div className="border-t border-border/40 pt-6">
                            <AboutSettings />
                        </div>
                    )}
                </div>
            </ScrollableOverlay>
        );
    }

    // Show specific section content
    const renderSectionContent = () => {
        switch (section) {
            case 'visual':
                return <VisualSectionContent runtimeCtx={runtimeCtx} />;
            case 'chat':
                return <ChatSectionContent runtimeCtx={runtimeCtx} />;
            case 'sessions':
                return <SessionsSectionContent runtimeCtx={runtimeCtx} />;
            case 'shortcuts':
                return <ShortcutsSectionContent runtimeCtx={runtimeCtx} />;
            case 'git':
                return <GitSectionContent runtimeCtx={runtimeCtx} />;
            case 'github':
                return <GitHubSectionContent runtimeCtx={runtimeCtx} />;
            case 'notifications':
                return <NotificationSectionContent runtimeCtx={runtimeCtx} />;
            case 'voice':
                return <VoiceSectionContent runtimeCtx={runtimeCtx} />;
            case 'tunnel':
                return <TunnelSectionContent runtimeCtx={runtimeCtx} />;
            default:
                return null;
        }
    };

    return (
        <ScrollableOverlay
            outerClassName="h-full"
            className="w-full"
        >
            <div className="openchamber-page-body mx-auto max-w-3xl space-y-6 p-3 sm:p-6 sm:pt-8">
                {renderSectionContent()}
            </div>
        </ScrollableOverlay>
    );
};

const ShortcutsSectionContent: React.FC<{ runtimeCtx: SettingsRuntimeContext }> = ({ runtimeCtx }) => {
    return (
        <>
            <KeyboardShortcutsSettings />
            <PluginSettingsSections pageSlug="shortcuts" runtimeCtx={runtimeCtx} />
        </>
    );
};

// Visual section: Theme Mode, Font Size, Spacing, Input Bar Offset (mobile), Nav Rail
const VisualSectionContent: React.FC<{ runtimeCtx: SettingsRuntimeContext }> = ({ runtimeCtx }) => {
    const isVSCode = isVSCodeRuntime();
    return (
        <>
            <OpenChamberVisualSettings visibleSettings={[
                'theme',
                'pwaInstallName',
                'pwaOrientation',
                'mobileKeyboardMode',
                'timeFormat',
                'weekStart',
                'fontSize',
                'terminalFontSize',
                'spacing',
                'inputBarOffset',
                ...(!isVSCode ? ['terminalQuickKeys' as const] : []),
                'reportUsage',
            ]} />
            <PluginSettingsSections pageSlug="appearance" runtimeCtx={runtimeCtx} />
        </>
    );
};

// Chat section: User message rendering, Diff layout, Mobile status bar, Show reasoning traces, Queue mode, Persist draft
const ChatSectionContent: React.FC<{ runtimeCtx: SettingsRuntimeContext }> = ({ runtimeCtx }) => {
    return (
        <>
            <OpenChamberVisualSettings visibleSettings={['chatRenderMode', 'messageTransport', 'activityRenderMode', 'userMessageRendering', 'mermaidRendering', 'reasoning', 'showToolFileIcons', 'expandedTools', 'stickyUserHeader', 'wideChatLayout', 'splitAssistantMessageActions', 'diffLayout', 'mobileStatusBar', 'dotfiles', 'queueMode', 'persistDraft', 'inputSpellcheck']} />
            <PluginSettingsSections pageSlug="chat" runtimeCtx={runtimeCtx} />
        </>
    );
};

// Sessions section: Default model & agent, Session retention
const SessionsSectionContent: React.FC<{ runtimeCtx: SettingsRuntimeContext }> = ({ runtimeCtx }) => {
    const isVSCode = isVSCodeRuntime();
    const showDesktopNetworkSettings = isDesktopShell() && isDesktopLocalOriginActive();
    return (
        <div className="space-y-6">
            <DefaultsSettings />
            {!isVSCode && (
                <div className="border-t border-border/40 pt-6">
                    <OpenCodeCliSettings />
                </div>
            )}
            {showDesktopNetworkSettings && (
                <div className="border-t border-border/40 pt-6">
                    <DesktopNetworkSettings />
                </div>
            )}
            <div className="border-t border-border/40 pt-6">
                <SessionRetentionSettings />
            </div>
            <div className="border-t border-border/40 pt-6">
                <PasskeySettings />
            </div>
            <PluginSettingsSections pageSlug="sessions" runtimeCtx={runtimeCtx} />
        </div>
    );
};

// Git section: Commit message model, Worktree settings
const GitSectionContent: React.FC<{ runtimeCtx: SettingsRuntimeContext }> = ({ runtimeCtx }) => {
    return (
        <div className="space-y-6">
            <GitSettings />
            <PluginSettingsSections pageSlug="git" runtimeCtx={runtimeCtx} />
        </div>
    );
};

// GitHub section: Connect account for PR/issue workflows
const GitHubSectionContent: React.FC<{ runtimeCtx: SettingsRuntimeContext }> = ({ runtimeCtx }) => {
    if (isVSCodeRuntime()) {
        return null;
    }
    return (
        <>
            <GitHubSettings />
            <PluginSettingsSections pageSlug="github" runtimeCtx={runtimeCtx} />
        </>
    );
};

// Notifications section: Native browser notifications
const NotificationSectionContent: React.FC<{ runtimeCtx: SettingsRuntimeContext }> = ({ runtimeCtx }) => {
    return (
        <>
            <NotificationSettings />
            <PluginSettingsSections pageSlug="notifications" runtimeCtx={runtimeCtx} />
        </>
    );
};

// Voice section: Language selection and continuous mode
const VoiceSectionContent: React.FC<{ runtimeCtx: SettingsRuntimeContext }> = ({ runtimeCtx }) => {
    if (isVSCodeRuntime()) {
        return null;
    }
    return (
        <>
            <VoiceSettings />
            <PluginSettingsSections pageSlug="voice" runtimeCtx={runtimeCtx} />
        </>
    );
};

const TunnelSectionContent: React.FC<{ runtimeCtx: SettingsRuntimeContext }> = ({ runtimeCtx }) => {
    if (isVSCodeRuntime()) {
        return null;
    }
    return (
        <>
            <TunnelSettings />
            <PluginSettingsSections pageSlug="tunnel" runtimeCtx={runtimeCtx} />
        </>
    );
};
