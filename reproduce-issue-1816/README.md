# Reproduction: Issue #1816 - Dual cursors with Chinese IME in built-in terminal

## Bug Description

When using a Chinese input method (IME) in OpenChamber's built-in terminal on macOS, two cursors of different sizes and positions are displayed simultaneously:
1. Ghostty's canvas-rendered bar cursor (at the correct terminal cursor position)
2. A browser-native IME composition cursor/underline in Ghostty's contenteditable container (at a different position)

## Root Cause Analysis

### Architecture Issue

The terminal uses Ghostty-web, which creates:
1. A **canvas** for rendering terminal output, including a canvas-rendered cursor (`cursorStyle: 'bar'`)
2. A **contenteditable container div** (`aria-label="Terminal input"`) for keyboard/IME input
3. A **hidden textarea** (1×1px, opacity 0, clipPath: inset(50%)) as fallback input surface

OpenChamber's `TerminalViewport` component has a **hidden input overlay** system (`useHiddenInputOverlay`) that is designed to prevent dual-cursor issues, but it is **only active on touch/mobile devices** (`enableTouchScroll={true}`).

### The Problem

On **desktop (macOS)**, the critical guard is inactive:

1. `useHiddenInputOverlay` = `false` (because `enableTouchScroll` is `false` on desktop)
2. `disableTerminalTextareas()` returns immediately without doing anything (line 163-165)
3. Ghostty's contenteditable container remains fully interactive

When a Chinese IME is active:
- Ghostty's canvas renders its cursor at the terminal cursor position
- The macOS IME shows composition text with a highlight/underline cursor in the contenteditable div
- The IME composition cursor/highlight can appear at a different position and size than Ghostty's canvas cursor

### CSS Protection Gaps

The CSS rules that suppress Ghostty's native input surfaces during active overlay mode only apply when `data-hidden-input-overlay-active="true"`:

```css
.terminal-viewport-container[data-hidden-input-overlay-active="true"] textarea:not([data-terminal-hidden-input="true"]),
.terminal-viewport-container[data-hidden-input-overlay-active="true"] input:not([data-terminal-hidden-input="true"]),
.terminal-viewport-container[data-hidden-input-overlay-active="true"] [contenteditable="true"] {
  opacity: 0 !important;
  font-size: 0 !important;
  ...
}
```

On desktop, this selector doesn't match, so Ghostty's contenteditable container still displays IME composition content visually.

The generic CSS rules (`caret-color: transparent`) are insufficient to suppress IME composition display on macOS.

### Key Code Locations

| File | Line(s) | Role |
|---|---|---|
| `packages/ui/src/components/terminal/TerminalViewport.tsx` | 146 | `useHiddenInputOverlay` only true for touch devices |
| `packages/ui/src/components/terminal/TerminalViewport.tsx` | 162-228 | `disableTerminalTextareas()` — only active when `useHiddenInputOverlay` is true |
| `packages/ui/src/components/terminal/TerminalViewport.tsx` | 1106 | `disableTerminalTextareas()` called during init (conditional on `useHiddenInputOverlay`) |
| `packages/ui/src/index.css` | 1432-1469 | CSS rules for cursor suppression — the `[data-hidden-input-overlay-active="true"]` rules don't apply on desktop |
| `packages/ui/src/components/views/TerminalView.tsx` | 96, 1196 | `enableTouchScroll` = `useTouchTerminalInput`, which is false on Electron desktop |

## Reproduction Steps (macOS)

1. Open OpenChamber desktop app on macOS
2. Open the built-in terminal (Cmd+J or click terminal tab)
3. Switch to a Chinese IME (e.g., Pinyin input)
4. Start typing in the terminal
5. Observe: two blinking cursors appear — one is Ghostty's bar cursor, the other is the IME composition cursor

## Expected Behavior

Only one cursor should be visible — Ghostty's canvas-rendered cursor. The IME composition should not produce a visible second cursor.

## Environment

- macOS
- OpenChamber v1.13.2 (and potentially other versions)
- Any Chinese IME (Sogou Pinyin, Apple Pinyin input, etc.)
