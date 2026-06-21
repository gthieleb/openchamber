/**
 * Reproduction test for issue #1755
 * 
 * Verifies the root cause: markdown file links with non-HTTP href values
 * bypass the external-link safety handler, causing full PWA reloads on mobile.
 * 
 * Run: bun test .agents/reproduce/reproduce-1755.test.ts
 */

import { describe, it, expect } from 'bun:test';

// --- Replicate the relevant functions from the source (simplified for testing) ---

const parseUrlSafely = (value: string): URL | null => {
  try {
    return new URL(value);
  } catch {
    return null;
  }
};

// From packages/ui/src/lib/url.ts
const isExternalHttpUrl = (url: string): boolean => {
  const parsed = parseUrlSafely(url.trim());
  if (!parsed) return false;
  return parsed.protocol === 'http:' || parsed.protocol === 'https:';
};

// From packages/ui/src/components/chat/markdown/markdownCore.ts
const escapeAttr = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Simplified version of markdownCore.ts link renderer
const renderLink = (href: string | undefined, text: string): string => {
  const target = href ?? '';
  // Agent mentions and skill links omitted for brevity — they're the same pattern
  const titleAttr = '';
  return `<a href="${escapeAttr(target)}"${titleAttr} class="external-link" target="_blank" rel="noopener noreferrer">${text}</a>`;
};

// Simplified version of useExternalLinkInteractions handleClick
const simulateExternalLinkClick = (href: string): { prevented: boolean; stopped: boolean } => {
  const result = { prevented: false, stopped: false };
  
  // Guard checks (mimics the handler)
  if (!isExternalHttpUrl(href)) {
    // Handler returns early WITHOUT preventDefault/stopsPropagation
    return result;
  }
  
  // Only HTTP URLs reach here
  result.prevented = true;
  result.stopped = true;
  return result;
};

// --- Tests ---

describe('Issue #1755 - File link PWA reload on mobile', () => {

  describe('isExternalHttpUrl', () => {
    it('returns true for http:// URLs', () => {
      expect(isExternalHttpUrl('http://example.com/file.ts')).toBe(true);
    });

    it('returns true for https:// URLs', () => {
      expect(isExternalHttpUrl('https://example.com/file.ts')).toBe(true);
    });

    it('returns false for relative file paths (the bug)', () => {
      // These are common in LLM messages when referencing local files
      expect(isExternalHttpUrl('src/app.ts')).toBe(false);           // just a filename
      expect(isExternalHttpUrl('./src/utils/helper.ts')).toBe(false); // relative path
      expect(isExternalHttpUrl('../src/app.ts:42')).toBe(false);      // with line number
    });

    it('returns false for file:// protocol URLs (the bug)', () => {
      expect(isExternalHttpUrl('file:///home/user/project/src/app.ts')).toBe(false);
      expect(isExternalHttpUrl('file:///C:/Users/user/project/app.ts')).toBe(false);
    });

    it('returns false for unparseable URLs', () => {
      expect(isExternalHttpUrl('app.ts:42:5')).toBe(false);       // line:col syntax
      expect(isExternalHttpUrl('')).toBe(false);
    });
  });

  describe('markdown link rendering', () => {
    it('renders all non-http links with target="_blank"', () => {
      const html = renderLink('src/app.ts', 'file.ts');
      expect(html).toContain('target="_blank"');
      expect(html).toContain('href="src/app.ts"');
      expect(html).toContain('external-link');
      expect(html).not.toContain('data-openchamber-file-link');
    });

    it('renders file:// links same as any other', () => {
      const html = renderLink('file:///home/user/app.ts', 'app.ts');
      expect(html).toContain('target="_blank"');
      expect(html).toContain('href="file:///home/user/app.ts"');
    });
  });

  describe('click handler gaps', () => {
    it('blocks navigation for http/https URLs', () => {
      const result = simulateExternalLinkClick('https://example.com');
      expect(result.prevented).toBe(true);
    });

    it('does NOT block navigation for relative file paths (THE BUG)', () => {
      const result = simulateExternalLinkClick('src/app.ts');
      expect(result.prevented).toBe(false);
      // → Browser navigates to src/app.ts, causing full PWA reload on mobile
    });

    it('does NOT block navigation for file:// URLs (THE BUG)', () => {
      const result = simulateExternalLinkClick('file:///home/user/app.ts');
      expect(result.prevented).toBe(false);
      // → Browser navigates to file:// URL, causing navigation error/reload
    });

    it('does NOT block navigation for line:col file references (THE BUG)', () => {
      const result = simulateExternalLinkClick('app.ts:42');
      expect(result.prevented).toBe(false);
    });
  });

  describe('end-to-end scenario', () => {
    it('LLM file link [src/app.ts](src/app.ts) bypasses all handlers', () => {
      // Step 1: Markdown renderer produces the <a> tag
      const html = renderLink('src/app.ts', 'src/app.ts');
      
      // Step 2: Auto-detection tries to annotate it
      // extractPathCandidateFromElement extracts href="src/app.ts"
      // isLikelyFilePath("src/app.ts") → true (has extension)
      // getResolvedReference resolves it
      // fileReferenceExists checks stat → could be false if file doesn't exist
      // If stat fails: no annotation
      
      // Step 3: useExternalLinkInteractions skips it (not HTTP)
      const clickResult = simulateExternalLinkClick('src/app.ts');
      
      // Step 4: No handler calls preventDefault()
      // Browser navigates to src/app.ts → PWA reloads
      expect(clickResult.prevented).toBe(false);
      expect(html).toContain('target="_blank"');
      // If file doesn't exist → no annotation → no handler catches it
    });

    it('LLM file link with file:// protocol bypasses both handlers', () => {
      // file:// URLs are NOT detected as file paths by isLikelyFilePathValue
      // because it checks: path.includes('://') → returns false
      
      const html = renderLink('file:///home/user/project/src/app.ts', 'app.ts');
      
      // fileReferenceExists would never be called because isLikelyFilePathValue
      // rejects URLs containing ://
      const isLikelyFilePathResult = 'src/app.ts'.includes('://'); // false, path ok
      const fileUrlRejected = 'file:///home/user/project/src/app.ts'.includes('://'); // TRUE
      
      expect(fileUrlRejected).toBe(true);
      
      // Neither useExternalLinkInteractions nor useFileReferenceInteractions
      // handle this click
      const clickResult = simulateExternalLinkClick('file:///home/user/project/src/app.ts');
      expect(clickResult.prevented).toBe(false);
    });
  });
});
