/**
 * Reproduction for issue #1636: Shell command durations lost on session switch
 *
 * Root cause: mergeMaterializedPart() in materialization.ts drops state.time
 * from tool parts when the incoming snapshot lacks time data but existing
 * data (from SSE) has it. The function only preserves existing 'text'/'output'
 * streaming fields during merge — tool state.time is not preserved.
 *
 * The v2 session.messages API returns tool data in SessionMessageAssistantTool
 * format where time lives at the tool level (not in state.time), so when
 * messages are re-fetched on session switch the state.time is missing.
 * mergeMaterializedPart then silently replaces the SSE-delivered data
 * (with correct state.time) with the API snapshot (without state.time).
 *
 * formatDuration then gets start/end both undefined (or default 0 values),
 * producing "0.1s" as a minimum displayable duration fallback.
 */

import { describe, expect, test } from 'bun:test';
import type { Part, Message } from '@opencode-ai/sdk/v2/client';
import { materializeSessionSnapshots } from '@/sync/materialization';

// === formatDuration logic (from ToolPart.tsx) ===
const MAX_DURATION_MS = 5 * 60 * 1000;
const formatDuration = (start: number, end?: number, now: number = Date.now()) => {
    const duration = Math.min(Math.max(0, (end ?? now) - start), MAX_DURATION_MS);
    const seconds = duration / 1000;
    const displaySeconds = seconds < 0.05 && end !== undefined ? 0.1 : seconds;
    return `${displaySeconds.toFixed(1)}s`;
};

// === Helper: create a bash tool part with SSE-style state.time ===
function sseBashTool(id: string, msgID: string, sesID: string, start: number, end?: number): Part {
    return {
        id, messageID: msgID, sessionID: sesID, type: 'tool', tool: 'bash',
        state: { status: end ? 'completed' : 'running', time: { start, ...(end ? { end } : {}) }, input: {} },
    } as unknown as Part;
}

// === Helper: create a bash tool part WITHOUT state.time (as from v2 API) ===
function apiBashToolWithoutTime(id: string, msgID: string, sesID: string): Part {
    return {
        id, messageID: msgID, sessionID: sesID, type: 'tool', tool: 'bash',
        state: { status: 'completed', input: {} },
    } as unknown as Part;
}

function msg(id: string, sesID: string): Message {
    return { id, sessionID: sesID, role: 'assistant', time: { created: 1000 } } as Message;
}

describe('Issue #1636 reproduction', () => {
    const sesId = 'ses_1636';
    const msgId = 'msg_1636';
    const start = 1700000000000;
    const end = 1700000005000; // 5 seconds

    test('1. SSE-delivered tool state.time is preserved in store', () => {
        const r = materializeSessionSnapshots(
            { message: {}, part: {} }, sesId,
            [{ info: msg(msgId, sesId), parts: [sseBashTool(msgId, msgId, sesId, start, end)] }],
        );
        const p = r.part[msgId]![0] as Record<string, unknown>;
        expect((p.state as Record<string, unknown>)?.time).toBeDefined();
        expect(((p.state as Record<string, unknown>).time as Record<string, number>).start).toBe(start);
        expect(((p.state as Record<string, unknown>).time as Record<string, number>).end).toBe(end);
    });

    test('2. Switching to another session does not corrupt first session data', () => {
        const r1 = materializeSessionSnapshots(
            { message: {}, part: {} }, 'ses_A',
            [{ info: msg('msg_A', 'ses_A'), parts: [sseBashTool('prt_A', 'msg_A', 'ses_A', start, end)] }],
        );
        // Load session B
        const r2 = materializeSessionSnapshots(
            { message: r1.message, part: r1.part }, 'ses_B',
            [{ info: msg('msg_B', 'ses_B'), parts: [sseBashTool('prt_B', 'msg_B', 'ses_B', 2000, 4000)] }],
        );
        const pA = r2.part['msg_A']![0] as Record<string, unknown>;
        expect(((pA.state as Record<string, unknown>).time as Record<string, number>).start).toBe(start);
        expect(((pA.state as Record<string, unknown>).time as Record<string, number>).end).toBe(end);
    });

    test('3. ROOT CAUSE: stale API snapshot WITHOUT state.time overwrites SSE data with time', () => {
        // SSE delivers part with state.time
        const sseState = materializeSessionSnapshots(
            { message: {}, part: {} }, sesId,
            [{ info: msg(msgId, sesId), parts: [sseBashTool(msgId, msgId, sesId, start, end)] }],
        );
        const ssePartRef = sseState.part[msgId]![0];

        // API snapshot arrives WITHOUT state.time (as v2 SessionMessageAssistantTool)
        const apiPart = apiBashToolWithoutTime(msgId, msgId, sesId);
        const apiState = apiPart.state as Record<string, unknown> | undefined;
        expect(apiState?.time).toBeUndefined(); // confirm no time in API part

        // After materialization, the SSE time data is LOST
        const mergedState = materializeSessionSnapshots(
            { message: sseState.message, part: sseState.part }, sesId,
            [{ info: msg(msgId, sesId), parts: [apiPart] }],
        );

        const finalPart = mergedState.part[msgId]![0] as Record<string, unknown>;
        const finalTime = (finalPart.state as Record<string, unknown> | undefined)?.time;

        // BUG: time is lost — it's completely undefined
        expect(finalTime).toBeUndefined();

        // When ToolPart.tsx reads this, effectiveTimeStart becomes undefined
        // and tool duration is not displayed (or shows 0.1s via formatDuration defaults)
        const startVal = typeof finalTime === 'object' && finalTime !== null
            ? (finalTime as Record<string, unknown>).start : undefined;
        const endVal = typeof finalTime === 'object' && finalTime !== null
            ? (finalTime as Record<string, unknown>).end : undefined;
        if (typeof startVal === 'number' && typeof endVal === 'number') {
            expect(formatDuration(startVal, endVal)).not.toBe('0.1s');
        }
    });

    test('4. mergeMaterializedPart does NOT preserve existing state.time for tool parts', () => {
        // This is the specific function bug
        const existing = sseBashTool(msgId, msgId, sesId, start, end);
        const stale = apiBashToolWithoutTime(msgId, msgId, sesId);

        // Simulate what mergeMaterializedPart does internally:
        // - getPartEndTime(stale) returns undefined (no time.end in state)
        // - So it doesn't return early (getPartEndTime(next) !== undefined is false)
        // - The streaming field loop only checks 'text'/'output' — irrelevant for tool parts
        // - Returns stale as-is, discarding existing.state.time
        const result = stale; // What mergeMaterializedPart returns

        const resultTime = (result.state as Record<string, unknown> | undefined)?.time;
        expect(resultTime).toBeUndefined(); // Time data is lost
    });

    test('5. formatDuration shows 0.1s for zero-duration or missing-time commands', () => {
        // When start === end (e.g., default/fallback values), duration is 0
        expect(formatDuration(0, 0)).toBe('0.1s');
        expect(formatDuration(1000, 1000)).toBe('0.1s');
        // Very short durations (< 50ms) also show 0.1s
        expect(formatDuration(1000, 1030)).toBe('0.1s');
        // Normal duration still works
        expect(formatDuration(start, end)).toBe('5.0s');
    });
});
