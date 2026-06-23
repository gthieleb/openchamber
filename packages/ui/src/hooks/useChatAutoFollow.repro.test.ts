/**
 * Reproduction tests for three interacting bugs in useChatAutoFollow:
 *
 * Bug 1 — Programmatic-write window never expires during LERP
 * Bug 2 — Scrollbar drag has no escape from auto-follow (only wheel/touch/keyboard do)
 * Bug 3 — Thinking-block height animation causes LERP oscillation and flicker
 *
 * These tests isolate and demonstrate each bug without rendering React components.
 * They exercise the same algorithms/logic patterns used in the hook.
 */
import { describe, expect, test } from 'bun:test';

// ---------------------------------------------------------------------------
// Shared constants (mirrored from useChatAutoFollow.ts)
// ---------------------------------------------------------------------------
const PROGRAMMATIC_WRITE_WINDOW_MS = 200;
const LERP = 0.18;
const SETTLE_EPSILON = 0.5;
const SETTLE_FRAMES = 4;

// ---------------------------------------------------------------------------
// Bug 1 — Programmatic-write window never expires
//
// `tickFollow()` calls `markProgrammaticWrite()` every RAF frame (~16ms).
// This sets programmaticWriteUntil = now + 200ms, perpetually renewed.
// While the LERP loop is active, the window never expires.
// ---------------------------------------------------------------------------
describe('Bug 1 — Programmatic-write window never expires', () => {
    test('markProgrammaticWrite called every frame keeps window alive indefinitely', () => {
        // Use a simulated clock so the test is deterministic
        let simulatedTime = 0;
        let programmaticWriteUntil = 0;

        const markProgrammaticWrite = () => {
            programmaticWriteUntil = simulatedTime + PROGRAMMATIC_WRITE_WINDOW_MS;
        };

        const isInProgrammaticWindow = () => {
            return simulatedTime < programmaticWriteUntil;
        };

        // Simulate 20 LERP frames (each ~16ms)
        for (let frames = 0; frames < 20; frames++) {
            // At each frame, tickFollow calls markProgrammaticWrite
            markProgrammaticWrite();
            simulatedTime += 16; // advance clock by 1 frame

            // The window should always cover the current time
            expect(isInProgrammaticWindow()).toBe(true);
        }

        // After 20 frames (320ms simulated), the window is still fresh
        expect(isInProgrammaticWindow()).toBe(true);

        // Only after we stop calling markProgrammaticWrite and wait 200ms,
        // the window expires
        simulatedTime += PROGRAMMATIC_WRITE_WINDOW_MS + 1;
        expect(isInProgrammaticWindow()).toBe(false);
    });

    test('tickFollow calls markProgrammaticWrite on every LERP frame', () => {
        // This simulates the actual tickFollow logic
        let markCount = 0;
        let programmaticWriteUntil = 0;

        const markProgrammaticWrite = () => {
            markCount++;
            programmaticWriteUntil = performance.now() + PROGRAMMATIC_WRITE_WINDOW_MS;
        };

        // Simulate LERP loop: current is 100, target is 500 (delta = 400)
        let scrollTop = 100;
        const scrollHeight = 1000;
        const clientHeight = 500;
        let isSettled = false;
        let settledFrames = 0;
        let frameCount = 0;

        while (!isSettled && frameCount < 100) {
            frameCount++;
            const target = Math.max(0, scrollHeight - clientHeight); // = 500
            const current = scrollTop;
            const delta = target - current;

            if (Math.abs(delta) <= SETTLE_EPSILON) {
                if (current !== target) {
                    markProgrammaticWrite();
                    scrollTop = target;
                }
                settledFrames++;
                if (settledFrames >= SETTLE_FRAMES) {
                    isSettled = true;
                    break;
                }
                continue;
            }

            settledFrames = 0;
            const next = current + delta * LERP;
            markProgrammaticWrite();
            scrollTop = next;
        }

        // markProgrammaticWrite is called on every non-settled frame (LERP path)
        // plus once more if current !== target in settled path
        // So markCount >= number of LERP frames
        expect(markCount >= frameCount - SETTLE_FRAMES).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// Bug 2 — Scrollbar drag has no escape from auto-follow
//
// handleScrollEvent checks isInProgrammaticWindow() at the top and returns
// early if true. Since the LERP loop constantly renews the window, ALL scroll
// events (including scrollbar drags) are discarded during active follow.
//
// Wheel, touch, and keyboard handlers bypass the programmatic check entirely
// and call releaseFromUserIntent() directly. Scrollbar drag does not.
// ---------------------------------------------------------------------------
describe('Bug 2 — Scrollbar drag has no escape from auto-follow', () => {
    test('scroll event during programmatic window is discarded even when scrolling up', () => {
        // Simulate the handleScrollEvent logic
        let state: 'following' | 'released' = 'following';
        let programmaticWindowActive = true; // Simulates active LERP loop
        let releasedByScroll = false;

        const handleScrollEvent = (scrollTop: number, previousScrollTop: number) => {
            if (programmaticWindowActive) {
                // BUG: returns early here — user-intent check below never runs
                return;
            }

            if (scrollTop < previousScrollTop && state === 'following') {
                releasedByScroll = true;
                state = 'released';
            }
        };

        // User drags scrollbar upward: scrollTop goes from 500 to 300
        handleScrollEvent(300, 500);

        // User-intent detection was skipped
        expect(releasedByScroll).toBe(false);
        expect(state).toBe('following');
    });

    test('wheel handler bypasses programmatic check and can release', () => {
        let state: 'following' | 'released' = 'following';
        let releasedCount = 0;

        const releaseFromUserIntent = () => {
            releasedCount++;
            state = 'released';
        };

        const handleWheel = (event: { deltaY: number }) => {
            if (event.deltaY >= 0) return;
            releaseFromUserIntent();
        };

        // Wheel up (deltaY < 0)
        handleWheel({ deltaY: -100 });

        expect(releasedCount).toBe(1);
        expect(state).toBe('released');
    });

    test('touch handler bypasses programmatic check and can release', () => {
        let state: 'following' | 'released' = 'following';
        let releasedCount = 0;

        const releaseFromUserIntent = () => {
            releasedCount++;
            state = 'released';
        };

        const TOUCH_FINGER_DOWN_THRESHOLD = 2;
        let touchLastY: number | null = 500;

        const handleTouchMove = (clientY: number) => {
            const previousY = touchLastY;
            touchLastY = clientY;
            if (previousY === null) return;
            const fingerDelta = clientY - previousY;
            if (fingerDelta <= TOUCH_FINGER_DOWN_THRESHOLD) return;
            releaseFromUserIntent();
        };

        // Finger moves down 50px
        handleTouchMove(550);
        expect(releasedCount).toBe(1);
        expect(state).toBe('released');
    });

    test('keyboard handler bypasses programmatic check and can release', () => {
        let state: 'following' | 'released' = 'following';
        let releasedCount = 0;

        const releaseFromUserIntent = () => {
            releasedCount++;
            state = 'released';
        };

        const isReleaseKey = (event: { key: string }): boolean => {
            switch (event.key) {
                case 'ArrowUp':
                case 'PageUp':
                case 'Home':
                    return true;
                default:
                    return false;
            }
        };

        const handleKeyDown = (event: { key: string }) => {
            if (!isReleaseKey(event)) return;
            releaseFromUserIntent();
        };

        handleKeyDown({ key: 'ArrowUp' });
        expect(releasedCount).toBe(1);
        expect(state).toBe('released');

        // Non-release keys don't trigger
        handleKeyDown({ key: 'ArrowDown' });
        expect(releasedCount).toBe(1);
    });
});

// ---------------------------------------------------------------------------
// Bug 3 — Thinking-block height animation causes LERP oscillation and flicker
//
// When a thinking block contracts, scrollHeight decreases → target moves up.
// LERP pulls scrollTop upward (delta < 0), away from the bottom.
// When it expands the next frame, LERP pulls scrollTop back down.
// This creates visible oscillation.
//
// During normal streaming, scrollHeight only grows, so delta >= 0 always.
// ---------------------------------------------------------------------------
describe('Bug 3 — Thinking-block height animation causes LERP oscillation', () => {
    test('LERP pulls scrollTop upward when scrollHeight decreases (contraction)', () => {
        const clientHeight = 500;
        let scrollHeight = 1500;
        let scrollTop = 1000; // Already near bottom

        // Frame 1: thinking block contract → scrollHeight decreases
        scrollHeight = 1200;
        const target1 = Math.max(0, scrollHeight - clientHeight); // = 700
        const delta1 = target1 - scrollTop; // 700 - 1000 = -300
        const next1 = scrollTop + delta1 * LERP; // 1000 + (-300 * 0.18) = 1000 - 54 = 946
        scrollTop = next1;

        // scrollTop was PULLED UPWARD (from 1000 to 946), away from the bottom
        // This is the oscillation — it moved up instead of staying at the bottom
        expect(next1 < 1000).toBe(true);
        expect(delta1 < 0).toBe(true);

        // Frame 2: block expands again → scrollHeight increases
        scrollHeight = 1500;
        const target2 = Math.max(0, scrollHeight - clientHeight); // = 1000
        const delta2 = target2 - scrollTop; // 1000 - 946 = 54
        const next2 = scrollTop + delta2 * LERP; // 946 + (54 * 0.18) = 946 + 9.72 = 955.72
        scrollTop = next2;

        // scrollTop was pulled BACK DOWN toward the bottom
        expect(next2).toBeGreaterThan(946);
        expect(delta2).toBeGreaterThan(0);

        // The oscillation creates a visible flicker as the view jumps up and down
        // every animation frame
    });

    test('delta is always >= 0 during normal monotonic streaming (no oscillation)', () => {
        const clientHeight = 500;
        let scrollHeight = 1000;
        let scrollTop = 500;

        // Simulate streaming text — scrollHeight only grows
        const heights = [1000, 1100, 1200, 1300, 1400, 1500];

        for (const nextHeight of heights) {
            scrollHeight = nextHeight;
            const target = Math.max(0, scrollHeight - clientHeight);
            const delta = target - scrollTop;

            // During normal streaming, scrollHeight never decreases,
            // so target only increases, and delta is always >= 0
            expect(delta >= 0).toBe(true);

            const next = scrollTop + delta * LERP;
            scrollTop = next;
        }
    });

    test('oscillation produces alternating positive/negative deltas', () => {
        const clientHeight = 500;

        // Simulate thinking block height animation:
        // Contract → Expand → Contract → Expand
        const scrollHeights = [1500, 1200, 1500, 1200, 1500, 1200];
        const deltas: number[] = [];
        let scrollTop = 1000;

        for (const sh of scrollHeights) {
            const target = Math.max(0, sh - clientHeight);
            const delta = target - scrollTop;
            deltas.push(delta);
            scrollTop = scrollTop + delta * LERP;
        }

        // Deltas alternate sign: negative (contract), positive (expand)
        expect(deltas[0] >= 0).toBe(true); // stable
        expect(deltas[1] < 0).toBe(true);  // contract → pull up
        expect(deltas[2] > 0).toBe(true);  // expand → pull down
        expect(deltas[3] < 0).toBe(true);  // contract → pull up
        expect(deltas[4] > 0).toBe(true);  // expand → pull down
        expect(deltas[5] < 0).toBe(true);  // contract → pull up

        // This alternating pattern creates visible flicker
    });
});
