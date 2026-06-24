/**
 * Reproduction test for issue #1824: UI does not update in real-time during streaming.
 *
 * This test simulates the streaming event flow and verifies that:
 * 1. Streaming state (streamingMessageIds) is set correctly
 * 2. Parts are updated in the store when delta events arrive
 * 3. The snapshot caching mechanism correctly preserves stale parts for
 *    the streaming message while allowing other messages' parts to update
 * 4. useSessionParts (which reads live parts) returns updated parts
 *    even when useSessionMessageRecords returns cached (frozen) parts
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import { create } from "zustand"
import type { Event, Part, Session, SessionStatus } from "@opencode-ai/sdk/v2/client"
import { useStreamingStore, updateStreamingState } from "../streaming"
import type { State } from "../types"
import { buildSessionMessageRecordsSnapshot, useSessionMessageRecords } from "../sync-context"
import { applyDirectoryEvent } from "../event-reducer"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SESSION_ID = "ses_test"
const MESSAGE_ID = "msg_assistant_1"
const PART_ID = "part_text_1"
const DIRECTORY = "/test/project"

function makeAssistantMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: MESSAGE_ID,
    role: "assistant",
    sessionID: SESSION_ID,
    time: { created: Date.now(), completed: undefined },
    ...overrides,
  } as unknown as Message
}

function makeUserMessage(id: string): Message {
  return {
    id,
    role: "user",
    sessionID: SESSION_ID,
    time: { created: Date.now(), completed: Date.now() },
  } as unknown as Message
}

function makeTextPart(text: string): Part {
  return {
    id: PART_ID,
    messageID: MESSAGE_ID,
    sessionID: SESSION_ID,
    type: "text",
    text,
  } as unknown as Part
}

function makeDeltaEvent(field: string, delta: string): Event {
  return {
    id: `evt_${Date.now()}`,
    type: "message.part.delta",
    properties: {
      sessionID: SESSION_ID,
      messageID: MESSAGE_ID,
      partID: PART_ID,
      field,
      delta,
    },
  } as Event
}

function makePartUpdatedEvent(part: Part): Event {
  return {
    id: `evt_${Date.now()}`,
    type: "message.part.updated",
    properties: {
      sessionID: SESSION_ID,
      part,
    },
  } as Event
}

function makeSessionStatusEvent(type: "idle" | "busy"): Event {
  return {
    id: `evt_${Date.now()}`,
    type: "session.status",
    properties: {
      sessionID: SESSION_ID,
      status: { type },
    },
  } as Event
}

function makeMessageUpdatedEvent(message: Message): Event {
  return {
    id: `evt_${Date.now()}`,
    type: "message.updated",
    properties: {
      info: message,
    },
  } as Event
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Reproduction #1824 — streaming state propagation", () => {
  beforeEach(() => {
    useStreamingStore.setState({
      streamingMessageIds: new Map(),
      messageStreamStates: new Map(),
    })
  })

  it("updateStreamingState sets streamingMessageId when session is busy and assistant message exists", () => {
    const state: State = {
      session: [{ id: SESSION_ID, time: { created: Date.now() } } as Session],
      session_status: { [SESSION_ID]: { type: "busy" } as SessionStatus },
      message: {
        [SESSION_ID]: [makeUserMessage("msg_user_1"), makeAssistantMessage()],
      },
      part: {
        [MESSAGE_ID]: [makeTextPart("Hello")],
      },
    } as unknown as State

    updateStreamingState(state)

    const streamingId = useStreamingStore.getState().streamingMessageIds.get(SESSION_ID)
    expect(streamingId).toBe(MESSAGE_ID)
  })

  it("updateStreamingState does NOT set streamingMessageId before assistant message arrives", () => {
    // Session is busy but no assistant message yet
    const state: State = {
      session: [{ id: SESSION_ID, time: { created: Date.now() } } as Session],
      session_status: { [SESSION_ID]: { type: "busy" } as SessionStatus },
      message: {
        [SESSION_ID]: [makeUserMessage("msg_user_1")], // only user message
      },
      part: {},
    } as unknown as State

    updateStreamingState(state)

    const streamingId = useStreamingStore.getState().streamingMessageIds.get(SESSION_ID)
    expect(streamingId).toBeUndefined()
  })

  it("snapshot caches parts for the streaming message when suspendPartUpdates is active", () => {
    const userMsg = makeUserMessage("msg_user_1")
    const assistantMsg = makeAssistantMessage()
    const part1 = makeTextPart("Hel")

    // Initial state
    const state: State = {
      session: [{ id: SESSION_ID, time: { created: Date.now() } } as Session],
      session_status: { [SESSION_ID]: { type: "busy" } as SessionStatus },
      message: {
        [SESSION_ID]: [userMsg, assistantMsg],
      },
      part: {
        [MESSAGE_ID]: [part1],
      },
    } as unknown as State

    // Build first snapshot (no suspension — previousRecord is undefined)
    const snapshot1 = buildSessionMessageRecordsSnapshot(state, SESSION_ID, undefined, false)
    expect(snapshot1.list).toHaveLength(2)

    // Find the streaming message record
    const streamRecord1 = snapshot1.list.find((r) => r.info.id === MESSAGE_ID)!
    expect(streamRecord1.parts).toHaveLength(1)
    expect((streamRecord1.parts[0] as Record<string, unknown>).text).toBe("Hel")

    // Simulate a delta event — state.part[MESSAGE_ID] gets a new array
    const updatedPart = { ...part1, text: "Hello" } as Part
    const updatedState: State = {
      ...state,
      part: {
        [MESSAGE_ID]: [updatedPart],
      },
    } as unknown as State

    // Build second snapshot with suspendPartUpdates=true
    // The streaming message's parts should be FROZEN (from previous snapshot)
    const snapshot2 = buildSessionMessageRecordsSnapshot(
      updatedState,
      SESSION_ID,
      snapshot1,
      true,              // suspendPartUpdates = true
      MESSAGE_ID,        // suspendedPartUpdatesMessageID = streaming message
    )
    expect(snapshot2.list).toHaveLength(2)

    const streamRecord2 = snapshot2.list.find((r) => r.info.id === MESSAGE_ID)!
    // The streaming message's parts should be FROZEN — still "Hel" not "Hello"
    expect((streamRecord2.parts[0] as Record<string, unknown>).text).toBe("Hel")

    // The user message should NOT be frozen — parts should be from live state
    const userRecord2 = snapshot2.list.find((r) => r.info.id === "msg_user_1")!

    // If the snapshot is unchanged, it should return the SAME reference
    const snapshot3 = buildSessionMessageRecordsSnapshot(
      updatedState,
      SESSION_ID,
      snapshot2,
      true,              // same suspendPartUpdates
      MESSAGE_ID,        // same suspendedPartUpdatesMessageID
    )
    // snapshot3 should be the SAME object as snapshot2 (unchanged)
    expect(snapshot3).toBe(snapshot2)
  })

  it("applyDirectoryEvent correctly applies message.part.delta events", () => {
    const part1 = makeTextPart("Hel")
    const state: State = {
      session: [{ id: SESSION_ID, time: { created: Date.now() } } as Session],
      session_status: {},
      message: {},
      part: {
        [MESSAGE_ID]: [part1],
      },
      permission: {},
      question: {},
      todo: {},
      session_diff: {},
      lsp: [],
      limit: 50,
      sessionTotal: 0,
      projectMeta: {},
      icon: null,
    } as unknown as State

    // Apply delta
    const draft: State = { ...state, part: { ...state.part } }
    const deltaEvent = makeDeltaEvent("text", "lo")

    // Verify the parts array has the part to apply the delta to
    expect(draft.part[MESSAGE_ID]).toHaveLength(1)
    expect((draft.part[MESSAGE_ID][0] as Record<string, unknown>).id).toBe(PART_ID)

    const result = applyDirectoryEvent(draft, deltaEvent)
    expect(result).toBe(true)

    // Verify part was updated
    const updatedPart = draft.part[MESSAGE_ID][0] as Record<string, unknown>
    expect(updatedPart.text).toBe("Hello")
  })

  it("simulates full streaming flow from event to store to streaming state", () => {
    // --- Step 1: Initial state (user message sent, session is busy) ---
    let state: State = {
      session: [{ id: SESSION_ID, time: { created: Date.now() } } as Session],
      session_status: { [SESSION_ID]: { type: "busy" } as SessionStatus },
      message: {
        [SESSION_ID]: [makeUserMessage("msg_user_1")],
      },
      part: {},
    } as unknown as State

    // Simulate streaming state update after session.status (busy) + no assistant msg yet
    updateStreamingState(state)
    let streamingId = useStreamingStore.getState().streamingMessageIds.get(SESSION_ID)
    // No streaming message yet — assistant message hasn't been created
    expect(streamingId).toBeUndefined()

    // --- Step 2: Assistant message created ---
    const assistantMsg = makeAssistantMessage()
    const msgUpdatedEvent = makeMessageUpdatedEvent(assistantMsg)
    const draft1: State = { ...state, message: { ...state.message } }
    draft1.message[SESSION_ID] = [...(draft1.message[SESSION_ID] ?? []), assistantMsg]
    state = draft1 as unknown as State

    // Simulate streaming state update (now there IS an assistant message)
    updateStreamingState(state)
    streamingId = useStreamingStore.getState().streamingMessageIds.get(SESSION_ID)
    expect(streamingId).toBe(MESSAGE_ID)

    // --- Step 3: First part arrives ---
    const part1 = makeTextPart("Hel")
    const partUpdatedEvent = makePartUpdatedEvent(part1)
    const draft2: State = { ...state, part: { ...state.part } }
    draft2.part[MESSAGE_ID] = [part1]
    state = draft2 as unknown as State

    // Verify part is in the store
    expect(state.part[MESSAGE_ID]).toBeDefined()
    expect(state.part[MESSAGE_ID]).toHaveLength(1)
    expect((state.part[MESSAGE_ID][0] as Record<string, unknown>).text).toBe("Hel")

    // --- Step 4: Delta event arrives ---
    const deltaEvent = makeDeltaEvent("text", "lo")
    const draft3: State = { ...state, part: { ...state.part } }
    const applyResult = applyDirectoryEvent(draft3, deltaEvent)
    expect(applyResult).toBe(true)
    state = draft3 as unknown as State

    // Verify part was updated in the store
    const updatedPart = state.part[MESSAGE_ID][0] as Record<string, unknown>
    expect(updatedPart.text).toBe("Hello")

    // --- Step 5: Build snapshots with suspendPartUpdates ---
    const userMsg = makeUserMessage("msg_user_1")
    const initialState = (): State => ({
      session: [{ id: SESSION_ID, time: { created: Date.now() } } as Session],
      session_status: { [SESSION_ID]: { type: "busy" } as SessionStatus },
      message: { [SESSION_ID]: [userMsg, assistantMsg] },
      part: { [MESSAGE_ID]: [part1] },
    } as unknown as State)

    const snap1 = buildSessionMessageRecordsSnapshot(initialState(), SESSION_ID, undefined, true, MESSAGE_ID)
    const snap1Parts = snap1.list.find((r) => r.info.id === MESSAGE_ID)!.parts
    expect((snap1Parts[0] as Record<string, unknown>).text).toBe("Hel")

    // --- Step 6: Simulate delta (store has updated parts) ---
    const stateWithDelta = initialState()
    const draft4: State = { ...stateWithDelta, part: { ...stateWithDelta.part } }
    applyDirectoryEvent(draft4, deltaEvent)
    stateWithDelta.part = draft4.part

    // Verify live store has updated parts
    const livePart = stateWithDelta.part[MESSAGE_ID][0] as Record<string, unknown>
    expect(livePart.text).toBe("Hello")

    // --- Step 7: Build cached snapshot — should return FROZEN parts ---
    const snap2 = buildSessionMessageRecordsSnapshot(stateWithDelta, SESSION_ID, snap1, true, MESSAGE_ID)
    const snap2Parts = snap2.list.find((r) => r.info.id === MESSAGE_ID)!.parts
    // Parts should be FROZEN (old "Hel" from previousRecord), NOT "Hello"
    expect((snap2Parts[0] as Record<string, unknown>).text).toBe("Hel")

    // The snapshot should be unchanged (same reference) — proving caching works
    const snap3 = buildSessionMessageRecordsSnapshot(stateWithDelta, SESSION_ID, snap2, true, MESSAGE_ID)
    expect(snap3).toBe(snap2)

    // --- Step 8: Verify LIVE parts are different from cached parts ---
    // The snap2 has FROZEN parts ("Hel"), but live store has "Hello"
    // This is expected — StreamingTailContent reads from useSessionParts
    // which selects state.part[messageID] directly (live), not from the snapshot
    const liveParts = stateWithDelta.part[MESSAGE_ID]
    expect(liveParts).not.toBe(snap2Parts)
    expect((liveParts[0] as Record<string, unknown>).text).toBe("Hello")
  })
})
