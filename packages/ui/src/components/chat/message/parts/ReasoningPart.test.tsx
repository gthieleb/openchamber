import React from 'react';
import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

import { I18nProvider } from '@/lib/i18n';
import { ReasoningTimelineBlock } from './ReasoningPart';

describe('ReasoningTimelineBlock', () => {
  test('renders reasoning traces behind an accessible collapsed disclosure by default', () => {
    const markup = renderToStaticMarkup(
      <I18nProvider>
        <ReasoningTimelineBlock
          text={'First thought.\nDetailed internal reasoning line'}
          variant="thinking"
          blockId="reasoning-test"
          showDuration={false}
        />
      </I18nProvider>,
    );

    expect(markup).toContain('<button');
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).toContain('aria-label="Expand reasoning trace"');
    expect(markup).toContain('First thought');
    expect(markup).not.toContain('Detailed internal reasoning line');
  });
});
