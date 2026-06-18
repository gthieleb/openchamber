/**
 * Reproduction script for scroll bar jitter issue (#1723)
 * 
 * Issue: On Windows, the scroll bar constantly moves up and down during 
 * streaming responses, and can get stuck.
 * 
 * Root cause: The overlay scrollbar thumb position is calculated from
 * scrollTop / (scrollHeight - clientHeight). During streaming:
 * 1. Content grows (scrollHeight increases) 
 * 2. LERP-based auto-follow (LERP=0.18) means scrollTop lags behind
 * 3. The thumb position ratio temporarily decreases → thumb moves UP
 * 4. As LERP catches up, scrollTop increases → thumb moves DOWN
 * 5. Repeat for each chunk → constant jitter
 * 
 * Additionally, with overflow-anchor:none and scrollbar-gutter:auto,
 * the native scrollbar interaction with the overlay scrollbar creates
 * visual instability on Windows where always-visible scrollbars are standard.
 */

const LERP = 0.18;
const SETTLE_EPSILON = 0.5;
const OVERLAY_MIN_THUMB_SIZE = 32;
const OVERLAY_TRACK_INSET = 8;

class SimulatedScrollContainer {
    scrollTop = 0;
    scrollHeight = 800;
    clientHeight = 600;

    growContent(px) {
        this.scrollHeight += px;
    }

    tickFollow() {
        const target = Math.max(0, this.scrollHeight - this.clientHeight);
        const current = this.scrollTop;
        const delta = target - current;

        if (Math.abs(delta) <= SETTLE_EPSILON) {
            if (current !== target) {
                this.scrollTop = target;
            }
            return { settled: true, delta: 0, target };
        }

        const next = current + delta * LERP;
        this.scrollTop = next;
        return { settled: false, delta, target };
    }
}

function computeOverlayThumb(scrollHeight, clientHeight, scrollTop) {
    const trackLength = Math.max(clientHeight - OVERLAY_TRACK_INSET * 2, 0);
    const rawThumb = (clientHeight / scrollHeight) * trackLength;
    const length = Math.max(OVERLAY_MIN_THUMB_SIZE, Math.min(trackLength, rawThumb));
    const maxOffset = Math.max(trackLength - length, 0);
    const maxScroll = Math.max(scrollHeight - clientHeight, 1);
    const offset = (scrollTop / maxScroll) * maxOffset;
    return {
        length: Math.round(length * 100) / 100,
        topPosition: Math.round((OVERLAY_TRACK_INSET + offset) * 100) / 100,
        offset: Math.round(offset * 100) / 100,
        trackLength: Math.round(trackLength * 100) / 100,
    };
}

function simulateStreaming(chunks, framesPerChunk, label) {
    const container = new SimulatedScrollContainer();
    const scrollHistory = [];
    const thumbHistory = [];

    console.log(`\n--- ${label} ---`);
    console.log(`Initial: scrollHeight=${container.scrollHeight}, clientHeight=${container.clientHeight}`);
    console.log(`Initial thumb: ${JSON.stringify(computeOverlayThumb(container.scrollHeight, container.clientHeight, container.scrollTop))}`);

    let frame = 0;
    for (const chunk of chunks) {
        for (let f = 0; f < framesPerChunk; f++) {
            frame++;
            const result = container.tickFollow();
            const thumb = computeOverlayThumb(container.scrollHeight, container.clientHeight, container.scrollTop);
            scrollHistory.push({ frame, ...result, scrollTop: container.scrollTop, scrollHeight: container.scrollHeight });
            thumbHistory.push({ frame, ...thumb });
        }
        container.growContent(chunk);
    }

    // Continue following
    for (let f = 0; f < 60; f++) {
        frame++;
        const result = container.tickFollow();
        const thumb = computeOverlayThumb(container.scrollHeight, container.clientHeight, container.scrollTop);
        scrollHistory.push({ frame, ...result, scrollTop: container.scrollTop, scrollHeight: container.scrollHeight });
        thumbHistory.push({ frame, ...thumb });
    }

    return { scrollHistory, thumbHistory, finalFrame: frame };
}

// Create a realistic streaming pattern
const streamingChunks = [
    8, 12, 5, 15, 10,    // First sentence
    20, 15, 8, 12, 18,   // Second sentence
    30, 25, 10, 15, 20,  // Code block
    8, 12, 5, 10, 15,    // More text
    50, 40, 30,           // Large section
];

console.log("=".repeat(70));
console.log("REPRODUCING ISSUE #1723: Scroll bar jitter on Windows");
console.log("=".repeat(70));

const { scrollHistory, thumbHistory } = simulateStreaming(streamingChunks, 3, "Realistic streaming pattern");

// Analyze scroll position monotonicity
let scrollDirectionChanges = 0;
let prevScrollDir = null;
for (let i = 1; i < scrollHistory.length; i++) {
    const diff = scrollHistory[i].scrollTop - scrollHistory[i-1].scrollTop;
    const dir = diff > 0.5 ? 'down' : (diff < -0.5 ? 'up' : 'stable');
    if (dir !== 'stable' && dir !== prevScrollDir && prevScrollDir !== null) {
        scrollDirectionChanges++;
    }
    if (dir !== 'stable') prevScrollDir = dir;
}

console.log(`\n--- Scroll Position Analysis ---`);
console.log(`Total frames: ${scrollHistory.length}`);
console.log(`ScrollTop direction changes: ${scrollDirectionChanges}`);
console.log(`Final: scrollTop=${scrollHistory[scrollHistory.length-1].scrollTop.toFixed(2)}, target=${scrollHistory[scrollHistory.length-1].target.toFixed(2)}`);

// Analyze overlay thumb jitter
let thumbUpMoves = 0;
let thumbDownMoves = 0;
for (let i = 1; i < thumbHistory.length; i++) {
    const diff = thumbHistory[i].topPosition - thumbHistory[i-1].topPosition;
    if (diff > 0.1) thumbDownMoves++;
    else if (diff < -0.1) thumbUpMoves++;
}

console.log(`\n--- Overlay Scrollbar Thumb Analysis ---`);
console.log(`Thumb movements: ${thumbUpMoves} UP, ${thumbDownMoves} DOWN`);
console.log(`Final thumb: ${JSON.stringify(thumbHistory[thumbHistory.length-1])}`);

// Show a sample of the jitter (frames where thumb moves up)
console.log(`\n--- Frames where overlay thumb moves UP (jitter) ---`);
let jitterFrames = [];
for (let i = 1; i < thumbHistory.length; i++) {
    const diff = thumbHistory[i].topPosition - thumbHistory[i-1].topPosition;
    if (diff < -0.1) {
        jitterFrames.push({
            frame: thumbHistory[i].frame,
            before: thumbHistory[i-1],
            after: thumbHistory[i],
            delta: Math.round(diff * 100) / 100,
        });
    }
}
console.log(`Total jitter events: ${jitterFrames.length}`);
if (jitterFrames.length > 0) {
    console.log(`First 10 jitter events:`);
    jitterFrames.slice(0, 10).forEach(jf => {
        console.log(`  Frame ${jf.frame}: thumbTop ${jf.before.topPosition}px -> ${jf.after.topPosition}px (delta: ${jf.delta}px, ${jf.delta > -0.5 ? 'SUBTLE' : 'VISIBLE'})`);
    });
}

// Also check for thumb length oscillation
let thumbLengthUp = 0;
let thumbLengthDown = 0;
for (let i = 1; i < thumbHistory.length; i++) {
    const diff = thumbHistory[i].length - thumbHistory[i-1].length;
    if (diff > 0.1) thumbLengthUp++;
    else if (diff < -0.1) thumbLengthDown++;
}

console.log(`\n--- Thumb Length Changes ---`);
console.log(`Length increased: ${thumbLengthUp} times, decreased: ${thumbLengthDown} times`);

// Overall verdict
console.log(`\n--- VERDICT ---`);
const hasScrollJitter = scrollDirectionChanges > 0;
const hasThumbJitter = jitterFrames.length > 0;

if (hasThumbJitter) {
    console.log(`❌ REPRODUCED: Overlay scrollbar thumb jitter detected (${jitterFrames.length} up movements during streaming)`);
    console.log(`   Root cause: thumb position = scrollTop / (scrollHeight - clientHeight)`);
    console.log(`   During streaming, scrollHeight grows while LERP-based follow lags,`);
    console.log(`   causing the overlay scrollbar thumb to oscillate.`);
    console.log(`   On Windows with always-visible scrollbars, this creates visible jitter.`);
    if (hasScrollJitter) {
        console.log(`   Additionally, actual scroll position also oscillates (${scrollDirectionChanges} direction changes).`);
    }
} else {
    console.log(`✅ No jitter detected`);
}
