import { describe, expect, test } from 'bun:test';
import { getShortcutAction, normalizeCombo, parseShortcut } from './shortcuts';

/**
 * Reproduction test for https://github.com/openchamber/openchamber/issues/1638
 *
 * Root cause: The default keyboard shortcuts for "Cycle favorite model forward"
 * (ctrl+]) and "Cycle favorite model backward" (ctrl+[) collide with Electron's
 * Windows/Linux application menu accelerators for "Back" (Ctrl+[) and
 * "Forward" (Ctrl+]) defined in packages/electron/main.mjs (buildAutoHiddenMenu).
 *
 * When Electron registers a menu item with an accelerator, the main process
 * intercepts the keyboard event BEFORE it reaches the renderer (web content).
 * The web page's keydown handler never fires, so the cycle favorite model
 * shortcuts are silently consumed by the Electron menu system on Windows/Linux.
 *
 * macOS is not affected because buildMacMenu() does not include a "Go" submenu
 * with Back/Forward shortcuts — it uses Cmd-based accelerators instead.
 *
 * Additionally, even if the collision is avoided (e.g. by changing the default
 * combo), the Electron menu items at packages/electron/main.mjs:3905-3906
 * register Ctrl+[ and Ctrl+] for go-back/go-forward navigation, which means:
 *   - The menu action fires dispatchAction('go-back') / dispatchAction('go-forward')
 *   - This calls useDirectoryStore.goBack() / .goForward() (see useMenuActions.ts)
 *   - So pressing Ctrl+[ or Ctrl+] on Windows not only fails to cycle models,
 *     but it also triggers unexpected directory navigation
 */

describe('cycle favorite model keyboard shortcuts', () => {
  test('default combo for cycle_favorite_model_forward is ctrl+]', () => {
    const action = getShortcutAction('cycle_favorite_model_forward');
    expect(action).not.toBeNull();
    expect(action!.defaultCombo).toBe('ctrl+]');
  });

  test('default combo for cycle_favorite_model_backward is ctrl+[', () => {
    const action = getShortcutAction('cycle_favorite_model_backward');
    expect(action).not.toBeNull();
    expect(action!.defaultCombo).toBe('ctrl+[');
  });

  test('parseShortcut correctly parses ctrl+]', () => {
    const parsed = parseShortcut('ctrl+]');
    expect(parsed.modifiers.has('ctrl')).toBe(true);
    expect(parsed.key).toBe(']');
  });

  test('parseShortcut correctly parses ctrl+[', () => {
    const parsed = parseShortcut('ctrl+[');
    expect(parsed.modifiers.has('ctrl')).toBe(true);
    expect(parsed.key).toBe('[');
  });

  test('normalizeCombo preserves ctrl+]', () => {
    expect(normalizeCombo('ctrl+]')).toBe('ctrl+]');
  });

  test('normalizeCombo preserves ctrl+[', () => {
    expect(normalizeCombo('ctrl+[')).toBe('ctrl+[');
  });

  test('Electron menu accelerators on Windows collide with cycle shortcut combos', () => {
    // The Electron menu in buildAutoHiddenMenu() (used on Windows/Linux) registers:
    //   { label: 'Back',    accelerator: 'Ctrl+[', click: () => dispatchAction('go-back') },
    //   { label: 'Forward', accelerator: 'Ctrl+]', click: () => dispatchAction('go-forward') },
    //
    // These accelerators share the exact same key combos as the cycle_favorite_model
    // shortcuts. Electron's menu system intercepts these at the main process level,
    // so the renderer never receives the keydown event.
    const cycleForward = getShortcutAction('cycle_favorite_model_forward')!;
    const cycleBackward = getShortcutAction('cycle_favorite_model_backward')!;

    // The Electron menu accelerators for Back/Forward
    const electronBack = 'Ctrl+[';
    const electronForward = 'Ctrl+]';

    // These are the exact same normalized combos — confirmed collision
    expect(normalizeCombo(cycleForward.defaultCombo)).toBe(normalizeCombo(electronForward));
    expect(normalizeCombo(cycleBackward.defaultCombo)).toBe(normalizeCombo(electronBack));

    // This collision means on Windows, pressing Ctrl+] triggers the Electron
    // "Forward" menu action instead of cycling favorite models forward.
    // On macOS, the menu does not register these accelerators, so it works.
  });
});
