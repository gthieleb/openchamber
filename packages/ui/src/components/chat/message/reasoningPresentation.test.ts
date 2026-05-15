import { describe, expect, test } from 'bun:test';

import { getReasoningTracePresentation } from './reasoningPresentation';

describe('getReasoningTracePresentation', () => {
  test('uses the collapsible timeline presentation for reasoning traces in live and sorted chat modes', () => {
    expect(getReasoningTracePresentation('live')).toBe('timeline');
    expect(getReasoningTracePresentation('sorted')).toBe('timeline');
  });
});
