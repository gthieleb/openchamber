import React from 'react';
import type { Part } from '@opencode-ai/sdk/v2';
import { cn } from '@/lib/utils';
import type { ContentChangeReason } from '@/hooks/useChatAutoFollow';
import { ScrollableOverlay } from '@/components/ui/ScrollableOverlay';
import { Icon } from "@/components/icon/Icon";
import type { IconName } from "@/components/icon/icons";
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n';
import { useUIStore } from '@/stores/useUIStore';
import { useDurationTickerNow } from './useDurationTicker';
import { MarkdownRenderer } from '../../MarkdownRenderer';
import { useStreamingTextThrottle } from '../../hooks/useStreamingTextThrottle';
import { getRandomWorkingPhrase } from '@/hooks/useAssistantStatus';

type PartWithText = Part & { text?: string; content?: string; time?: { start?: number; end?: number } };

export type ReasoningVariant = 'thinking' | 'justification';

const variantConfig: Record<
    ReasoningVariant,
    { labelKey: 'chat.reasoningTrace.thinking' | 'chat.reasoningTrace.justification'; Icon: IconName }
> = {
    thinking: { labelKey: 'chat.reasoningTrace.thinking', Icon: 'brain-ai-3' },
    justification: { labelKey: 'chat.reasoningTrace.justification', Icon: 'chat-ai-3' },
};

const cleanReasoningText = (text: string): string => {
    if (typeof text !== 'string' || text.trim().length === 0) {
        return '';
    }

    return text
        .split('\n')
        .map((line: string) => line.replace(/^>\s?/, '').trimEnd())
        .filter((line: string) => line.trim().length > 0)
        .join('\n')
        .trim();
};

const getReasoningSummary = (text: string): string => {
    if (!text) {
        return '';
    }

    const trimmed = text.trim();
    const newlineIndex = trimmed.indexOf('\n');
    const periodIndex = trimmed.indexOf('.');

    const cutoffCandidates = [
        newlineIndex >= 0 ? newlineIndex : Infinity,
        periodIndex >= 0 ? periodIndex : Infinity,
    ];
    const cutoff = Math.min(...cutoffCandidates);

    if (!Number.isFinite(cutoff)) {
        return trimmed;
    }

    return trimmed.substring(0, cutoff).trim();
};

const formatDuration = (start: number, end?: number, now: number = Date.now()): string => {
    const duration = end ? end - start : now - start;
    const seconds = duration / 1000;
    const displaySeconds = seconds < 0.05 && end !== undefined ? 0.1 : seconds;
    return `${displaySeconds.toFixed(1)}s`;
};

const LiveDuration: React.FC<{ start: number; end?: number; active: boolean }> = ({ start, end, active }) => {
    const now = useDurationTickerNow(active, 250);

    return <>{formatDuration(start, end, now)}</>;
};

type ReasoningTimelineBlockProps = {
    text: string;
    variant: ReasoningVariant;
    onContentChange?: (reason?: ContentChangeReason) => void;
    blockId: string;
    time?: { start?: number; end?: number };
    showDuration?: boolean;
    isStreaming?: boolean;
    actions?: React.ReactNode;
    alwaysShowActions?: boolean;
};

export const ReasoningTimelineBlock: React.FC<ReasoningTimelineBlockProps> = ({
    text,
    variant,
    onContentChange,
    blockId,
    time,
    showDuration = true,
    isStreaming = false,
    actions,
    alwaysShowActions = false,
}) => {
    const { t } = useI18n();
    const [isExpanded, setIsExpanded] = React.useState(false);
    const contentId = React.useId();

    const summary = React.useMemo(() => getReasoningSummary(text), [text]);
    const { labelKey, Icon: iconName } = variantConfig[variant];
    const randomPhrase = React.useMemo(() => getRandomWorkingPhrase(), []);
    const label = variant === 'thinking' ? randomPhrase : t(labelKey);
    const timeStart = typeof time?.start === 'number' && Number.isFinite(time.start) ? time.start : undefined;
    const timeEnd = typeof time?.end === 'number' && Number.isFinite(time.end) ? time.end : undefined;
    const toggleAriaLabel = isExpanded
        ? t('chat.reasoningTrace.collapseAria')
        : t('chat.reasoningTrace.expandAria');

    const handleToggle = React.useCallback(() => {
        setIsExpanded((prev) => !prev);
        onContentChange?.('structural');
    }, [onContentChange]);

    React.useEffect(() => {
        if (text.trim().length === 0) {
            return;
        }
        onContentChange?.('structural');
    }, [onContentChange, text]);

    if (!text || text.trim().length === 0) {
        return null;
    }

    return (
        <div className="my-1" data-reasoning-block-id={blockId} data-message-text-export-root="true">
            <Button
                type="button"
                variant="ghost"
                aria-expanded={isExpanded}
                aria-controls={contentId}
                aria-label={toggleAriaLabel}
                className={cn(
                    'group/tool h-auto w-full justify-start gap-2 rounded-xl bg-transparent pr-2 pl-px py-1.5 text-left normal-case tracking-normal hover:bg-[var(--interactive-hover)] hover:text-[var(--surface-foreground)]'
                )}
                onClick={handleToggle}
            >
                <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="relative h-3.5 w-3.5 flex-shrink-0">
                        <div
                            className={cn(
                                'absolute inset-0 transition-opacity',
                                isExpanded && 'opacity-0',
                                !isExpanded && (alwaysShowActions ? 'opacity-0' : 'group-hover/tool:opacity-0')
                            )}
                        >
                            <Icon name={iconName} className="h-3.5 w-3.5" />
                        </div>
                        <div
                            className={cn(
                                'absolute inset-0 transition-opacity flex items-center justify-center',
                                isExpanded && 'opacity-100',
                                !isExpanded && (alwaysShowActions ? 'opacity-100' : 'opacity-0 group-hover/tool:opacity-100')
                            )}
                        >
                            {isExpanded ? <Icon name="arrow-down-s" className="h-3.5 w-3.5" /> : <Icon name="arrow-right-s" className="h-3.5 w-3.5" />}
                        </div>
                    </div>
                    <span className="typography-meta font-medium inline-flex items-center">
                        {label}
                        {isStreaming && variant === 'thinking' ? (
                            <span className="inline-flex ml-px" aria-hidden="true">
                                <span className="thinking-dot" style={{ animationDelay: '0ms' }}>.</span>
                                <span className="thinking-dot" style={{ animationDelay: '200ms' }}>.</span>
                                <span className="thinking-dot" style={{ animationDelay: '400ms' }}>.</span>
                            </span>
                        ) : null}
                    </span>
                </div>

                {(summary || (showDuration && typeof timeStart === 'number')) ? (
                    <div className="flex items-center gap-1 flex-1 min-w-0 typography-meta text-muted-foreground/70">
                        {summary ? <span className="flex-1 min-w-0 truncate">{summary}</span> : null}
                        {showDuration && typeof timeStart === 'number' ? (
                            <span className="relative flex-shrink-0 tabular-nums text-right">
                                <span className="text-muted-foreground/80 transition-opacity duration-150">
                                    <LiveDuration
                                        start={timeStart}
                                        end={timeEnd}
                                        active={typeof timeEnd !== 'number'}
                                    />
                                </span>
                            </span>
                        ) : null}
                    </div>
                ) : null}
            </Button>

            {isExpanded && (
                <div
                    id={contentId}
                    className={cn(
                        'relative pr-2 pb-2 pt-2 pl-4'
                    )}
                >
                    <ScrollableOverlay
                        as="div"
                        outerClassName="max-h-80"
                        className="p-0"
                    >
                        <div data-message-text-export-source="true">
                            <MarkdownRenderer
                                content={text}
                                messageId={blockId}
                                isAnimated={false}
                                isStreaming={isStreaming}
                                variant="reasoning"
                            />
                        </div>
                        {actions ? (
                            <div className="mt-2 mb-1 flex items-center justify-start gap-1.5" data-message-actions="true">
                                <div className="flex items-center gap-1.5" data-message-action-group="true">
                                    {actions}
                                </div>
                            </div>
                        ) : null}
                    </ScrollableOverlay>
                </div>
            )}
        </div>
    );
};

type ReasoningPartProps = {
    part: Part;
    onContentChange?: (reason?: ContentChangeReason) => void;
    messageId: string;
    alwaysShowActions?: boolean;
};

const ReasoningPart = React.memo(({
    part,
    onContentChange,
    messageId,
    alwaysShowActions = false,
}: ReasoningPartProps) => {
    const chatRenderMode = useUIStore((state) => state.chatRenderMode);
    const partWithText = part as PartWithText;
    const rawText = partWithText.text || partWithText.content || '';
    const textContent = React.useMemo(() => cleanReasoningText(rawText), [rawText]);
    const time = partWithText.time;
    const isStreaming = chatRenderMode === 'live' && typeof time?.end !== 'number';
    const throttledText = useStreamingTextThrottle({
        text: textContent,
        isStreaming,
        identityKey: `${messageId}:${part.id ?? 'reasoning'}`,
    });

    // Show reasoning even if time.end isn't set yet (during streaming)
    // Only hide if there's no text content
    if (!throttledText || throttledText.trim().length === 0) {
        return null;
    }

    return (
        <ReasoningTimelineBlock
            text={throttledText}
            variant="thinking"
            onContentChange={onContentChange}
            blockId={part.id || `${messageId}-reasoning`}
            time={time}
            showDuration={chatRenderMode !== 'sorted'}
            isStreaming={isStreaming}
            alwaysShowActions={alwaysShowActions}
        />
    );
});

// eslint-disable-next-line react-refresh/only-export-components
export const formatReasoningText = (text: string): string => cleanReasoningText(text);

export default ReasoningPart;
