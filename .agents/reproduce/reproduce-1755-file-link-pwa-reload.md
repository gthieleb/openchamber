# Reproduction: Clicking file links from a message reloads the whole PWA on mobile

**Issue**: #1755  
**Bug**: Expected file preview to open on mobile but the whole PWA app reloads

---

## Root Cause Analysis

The bug is caused by a gap in the link interception logic in `useExternalLinkInteractions` (`packages/ui/src/components/chat/MarkdownRendererImpl.tsx`). When the LLM or user writes a markdown file link — either as `[path](relative/path.ts)` or `[path](file:///absolute/path.ts)` — the rendered HTML is an `<a>` tag. However, the external-link click handler **only intercepts `http://` and `https://` URLs**, letting all other URLs pass through unhandled.

### The code path

1. The `marked` markdown renderer (`packages/ui/src/components/chat/markdown/markdownCore.ts` line 180) renders all non-agent, non-skill links as:
   ```html
   <a href="relative/path.ts" class="external-link" target="_blank" rel="noopener noreferrer">text</a>
   ```

2. The `useExternalLinkInteractions` click handler (`MarkdownRendererImpl.tsx` lines 59-86) checks `isExternalHttpUrl(href)`:
   ```ts
   // MarkdownRendererImpl.tsx line 78-81
   const href = anchor.getAttribute('href') ?? '';
   if (!isExternalHttpUrl(href)) {
     return;  // ← EARLY RETURN: no preventDefault(), no stopPropagation()
   }
   event.preventDefault();
   ```

3. `isExternalHttpUrl` (`packages/ui/src/lib/url.ts` lines 15-21) returns `true` **only for `http:` and `https:` protocols**:
   ```ts
   export const isExternalHttpUrl = (url: string): boolean => {
     const parsed = parseUrlSafely(url.trim());
     if (!parsed) return false;
     return parsed.protocol === 'http:' || parsed.protocol === 'https:';
   };
   ```
   - Relative paths like `src/file.ts` → `parseUrlSafely` returns `null` → `false`
   - `file:///path/to/file.ts` → `parseUrlSafely` works, but `protocol` is `'file:'` → `false`

4. The auto-detected file reference pipeline (`useFileReferenceInteractions`) can still annotate the `<a>` element with `data-openchamber-file-link="true"` by checking the file against `/api/fs/stat`. **But annotation fails** when:
   - The file doesn't exist on the server (stat returns `false`)
   - The `href` contains `://` (e.g., `file:///path`) — `isLikelyFilePathValue` (line 323) rejects paths with `://`
   - The max file reference limit is reached (40 for mobile/VS Code, 80 for desktop)
   - The stat request fails or times out

5. When annotation fails, **neither handler prevents the default navigation**. The `<a>` tag has `target="_blank"`, but on mobile PWA:
   - **iOS Safari PWA < 16.4**: `target="_blank"` navigates within the PWA scope → full app reload with the file path as URL
   - **iOS Safari PWA >= 16.4**: Opens in Safari (no PWA reload, but still not an in-app file preview)
   - **Android Chrome PWA**: Opens Chrome Custom Tab (no PWA reload, but not in-app preview)

6. The SPA server has no route for arbitrary file paths, so the catch-all serves `index.html` (the app reboots from scratch), or in some configurations returns a 404.

### The gap on mobile

On desktop with `target="_blank"`, the link opens a new browser tab — annoying but not catastrophic. On mobile PWA, however, the navigation is either in-app (causing a full reload) or out-of-app (losing the user's context). Neither is the expected behavior of showing a file preview inline.

---

## Reproduction Steps

### Prerequisites
- OpenChamber running on mobile (PWA/Web), served via HTTPS
- A chat session

### Steps

1. Send a message containing a markdown file link in any of these formats:
   - `[file.ts](relative/path/to/nonexistent/file.ts)` — a link to a file that doesn't exist on the server
   - `[file.ts](file:///absolute/path/nonexistent.ts)` — a `file://` protocol URL
   - `[file.ts](path/to/file.ts)` — a relative link where `/api/fs/stat` fails or times out

2. Tap/click the rendered link in the chat message.

3. **Expected**: A file preview appears within the app (e.g., opens in the context panel or a preview dialog).
   
4. **Actual**: The PWA app reloads entirely (iOS PWA < 16.4 navigates in-window; newer iOS/Android may open system browser).

### Verification via code analysis

The following unit tests can verify the root cause:

```ts
// isExternalHttpUrl returns false for file:// and relative URLs
import { isExternalHttpUrl } from '@/lib/url';

isExternalHttpUrl('src/app.ts');              // → false (relative path)
isExternalHttpUrl('file:///home/user/app.ts'); // → false (file: protocol)
isExternalHttpUrl('app.ts:42');               // → false (unparsable)
isExternalHttpUrl('https://example.com');     // → true  (only this is handled)

// useExternalLinkInteractions returns early for non-HTTP URLs
// → No event.preventDefault() is called
// → Browser default navigation proceeds
```

---

## Affected Code

| File | Lines | Issue |
|------|-------|-------|
| `packages/ui/src/components/chat/MarkdownRendererImpl.tsx` | 78-81 | `useExternalLinkInteractions` only handles http/https URLs; non-HTTP URLs are silently skipped without `preventDefault()` |
| `packages/ui/src/lib/url.ts` | 15-21 | `isExternalHttpUrl` returns `false` for non-HTTP protocols |
| `packages/ui/src/components/chat/MarkdownRendererImpl.tsx` | 323-324 | `isLikelyFilePathValue` rejects paths containing `://`, so `file://` paths are never annotated as file references |
| `packages/ui/src/components/chat/markdown/markdownCore.ts` | 180 | All links get `target="_blank"` which doesn't prevent in-app navigation on some mobile PWA implementations |
