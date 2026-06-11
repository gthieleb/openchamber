/**
 * Reproduction test for issue #1612:
 * Pasted text containing @ should NOT trigger file attachment / mention autocomplete.
 *
 * Root cause: updateAutocompleteState() in ChatInput.tsx (line 2738) checks
 * `textBeforeCursor.lastIndexOf('@')` without distinguishing between an `@`
 * the user typed manually vs. one that came from a paste operation.
 *
 * When the user pastes text containing `@`:
 * 1. handlePaste() returns early for non-image text (line 2924) without e.preventDefault()
 * 2. Browser default paste inserts the text
 * 3. onChange fires -> handleTextChange -> updateAutocompleteState() (line 2862)
 * 4. updateAutocompleteState finds the `@` and incorrectly opens file mention autocomplete
 */
import { describe, expect, test } from 'bun:test';

/**
 * Extracted core logic from ChatInput.tsx updateAutocompleteState()
 * (lines 2738-2751) to demonstrate the bug in isolation.
 *
 * Returns `true` if the file mention popup would be triggered.
 */
function wouldTriggerFileMention(textBeforeCursor: string): boolean {
    const lastAtSymbol = textBeforeCursor.lastIndexOf('@');
    if (lastAtSymbol !== -1) {
        const charBefore =
            lastAtSymbol > 0 ? textBeforeCursor[lastAtSymbol - 1] : null;
        const textAfterAt = textBeforeCursor.substring(lastAtSymbol + 1);
        const isWordBoundary = !charBefore || /\s/.test(charBefore);
        if (
            isWordBoundary &&
            !textAfterAt.includes(' ') &&
            !textAfterAt.includes('\n')
        ) {
            return true; // would call setShowFileMention(true)
        }
    }
    return false;
}

describe('@-mention detection on paste (issue #1612)', () => {
    // ===== BUG REPRODUCTION CASES =====

    /**
     * BUG: Pasted text "Check the @config" triggers file mention popup.
     * The user pasted text containing @config from somewhere else (e.g., a config file path).
     * Cursor is at end of pasted text so `config` is the last word with no trailing space.
     */
    test('BUG: pasted text ending with @word triggers file mention', () => {
        const textBeforeCursor = 'Check the @config';

        const triggered = wouldTriggerFileMention(textBeforeCursor);

        // EXPECTED: false — pasted @ should NOT trigger file mention
        // ACTUAL (BUG): true because '@config' passes all detection checks:
        //   - '@' preceded by space  -> isWordBoundary = true
        //   - textAfterAt = "config" -> no space, no newline
        expect(triggered).toBe(false);
    });

    /**
     * BUG: Pasted "@alice" (a username copied from elsewhere) pasted as the entire
     * message content triggers file mention popup.
     */
    test('BUG: pasted @mention as entire message triggers file mention', () => {
        const textBeforeCursor = '@alice';

        const triggered = wouldTriggerFileMention(textBeforeCursor);

        // EXPECTED: false — pasted @ should NOT trigger file mention
        // ACTUAL (BUG): true because:
        //   - '@' at position 0 -> charBefore = null -> isWordBoundary = true
        //   - textAfterAt = "alice" -> no space, no newline
        expect(triggered).toBe(false);
    });

    /**
     * BUG: Pasted text "Use @main.ts" triggers file mention popup.
     * @main.ts looks like a file reference to the detection logic.
     */
    test('BUG: pasted @filename.ext triggers file mention', () => {
        const textBeforeCursor = 'Use @main.ts';

        const triggered = wouldTriggerFileMention(textBeforeCursor);

        // EXPECTED: false — pasted @ should NOT trigger file mention
        // ACTUAL (BUG): true because '@main.ts' passes all detection checks
        expect(triggered).toBe(false);
    });

    /**
     * BUG: Pasting text that contains standalone @mention as the last token
     * e.g., pasted message "Config is at @AppData" where cursor lands after paste
     */
    test('BUG: pasted text with @mention as last token triggers file mention', () => {
        const textBeforeCursor = 'Config is at @AppData';

        const triggered = wouldTriggerFileMention(textBeforeCursor);

        // EXPECTED: false — pasted @ should NOT trigger file mention
        expect(triggered).toBe(false);
    });

    // ===== EXISTING BEHAVIOR PRESERVED =====

    /**
     * Manually typed @ should still trigger file mention (existing behavior)
     */
    test('manually typed @ still triggers file mention', () => {
        // User types "Can you look at @config" manually
        const textBeforeCursor = 'Can you look at @config';

        const triggered = wouldTriggerFileMention(textBeforeCursor);

        expect(triggered).toBe(true);
    });

    /**
     * @ inside a word (e.g., email) should not trigger (existing behavior)
     */
    test('@ inside email address does not trigger file mention', () => {
        const textBeforeCursor = 'Email me at user@example.com';

        const triggered = wouldTriggerFileMention(textBeforeCursor);

        // '@' preceded by 'r' (not a word boundary)
        expect(triggered).toBe(false);
    });

    /**
     * Pasted text where @ is NOT at word boundary should not trigger (existing behavior)
     */
    test('pasted @ inside word does not trigger file mention', () => {
        const textBeforeCursor = 'please check user@example.com';

        const triggered = wouldTriggerFileMention(textBeforeCursor);

        // '@' preceded by 'r' (not a word boundary)
        expect(triggered).toBe(false);
    });

    /**
     * If there's a space or newline after @, it should not trigger (existing behavior)
     */
    test('@ followed by space does not trigger file mention', () => {
        const textBeforeCursor = 'Can you check @ config';

        const triggered = wouldTriggerFileMention(textBeforeCursor);

        // textAfterAt = " config" -> starts with space -> includes space
        expect(triggered).toBe(false);
    });
});
