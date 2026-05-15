import type { ChatRenderMode } from '@/stores/useUIStore';

export type ReasoningTracePresentation = 'inline' | 'timeline';

export const getReasoningTracePresentation = (
  chatRenderMode: ChatRenderMode,
): ReasoningTracePresentation => {
  void chatRenderMode;
  return 'timeline';
};
