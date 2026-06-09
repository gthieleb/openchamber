/**
 * Reproduction test for issue #1577: "Can not continue session, after send
 * message, models info just show and disappeared"
 *
 * This test simulates the SSE event flow that happens when a user sends a
 * message and the AI responds. It tests several scenarios where the AI
 * response could appear briefly and then disappear.
 */
import { describe, expect, test } from "bun:test"
import type { Event, Part, Message, Session, SessionStatus } from "@opencode-ai/sdk/v2/client"
import { applyDirectoryEvent } from "../event-reducer"
import { materializeSessionSnapshots } from "../materialization"
import { INITIAL_STATE, type State } from "../types"

// ── Helper factories ──────────────────────────────────────────────────────────

function makeState(overrides: Partial<State> = {}): State {
  return {
    ...INITIAL_STATE,
    message: {},
    part: {},
    session_status: {},
    ...overrides,
  }
}

function msg(id: string, sessionID = "ses_1", role: "user" | "assistant" = "assistant", completed?: number): Message {
  return {
    id,
    sessionID,
    role,
    time: { created: Date.now(), ...(completed !== undefined ? { completed } : {}) },
  } as Message
}

function part(id: string, messageID: string, type = "text", text = ""): Part {
  return {
    id,
    messageID,
    sessionID: "ses_1",
    type,
    text,
  } as Part
}

function sessionInfo(id: string, overrides: Partial<Session> = {}): Session {
  return {
    id,
    time: { created: Date.now(), updated: Date.now() },
    ...overrides,
  } as Session
}

// ── Event factories ───────────────────────────────────────────────────────────

function sessionUpdatedEvent(info: Session): Event {
  return {
    type: "session.updated",
    properties: { info },
  } as Event
}

function sessionStatusEvent(sessionID: string, status: SessionStatus): Event {
  return {
    type: "session.status",
    properties: { sessionID, status },
  } as Event
}

function sessionIdleEvent(sessionID: string): Event {
  return {
    type: "session.idle",
    properties: { sessionID },
  } as Event
}

function messageUpdatedEvent(info: Message): Event {
  return {
    type: "message.updated",
    properties: { info },
  } as Event
}

function messageRemovedEvent(sessionID: string, messageID: string): Event {
  return {
    type: "message.removed",
    properties: { sessionID, messageID },
  } as Event
}

function partDeltaEvent(messageID: string, partID: string, field: string, delta: string): Event {
  return {
    type: "message.part.delta",
    properties: { messageID, partID, field, delta, sessionID: "ses_1" },
  } as Event
}

function partUpdatedEvent(part: Part): Event {
  return {
    type: "message.part.updated",
    properties: { part, sessionID: "ses_1" },
  } as Event
}

// ── Test: Session archived after completion ───────────────────────────────────

describe("Issue #1577: message disappears after response", () => {
  test("SCENARIO 1: session.updated with time.archived removes session immediately", () => {
    // Simulate: User sends message → AI responds → session gets archived
    const sesId = "ses_1"
    const userMsgId = "msg_user_1"
    const assistantMsgId = "msg_ai_1"

    // Initial state: one session with a user message
    const initial = makeState({
      session: [sessionInfo(sesId)],
      sessionTotal: 1,
      limit: 50,
      message: {
        [sesId]: [msg(userMsgId, sesId, "user")],
      },
      session_status: {
        [sesId]: { type: "busy" },
      },
    })

    let draft = structuredClone(initial)

    // 1. AI message is created
    const aiMsg = msg(assistantMsgId, sesId, "assistant")
    const result1 = applyDirectoryEvent(draft, messageUpdatedEvent(aiMsg))
    expect(typeof result1 === "boolean" ? result1 : result1.changed).toBe(true)
    expect(draft.message[sesId]?.find((m) => m.id === assistantMsgId)).toBeDefined()
    expect(draft.session.find((s) => s.id === sesId)).toBeDefined()

    // 2. Session gets archived (what the OpenCode server might send after completion)
    draft = structuredClone(draft)
    const archivingSession = sessionInfo(sesId, {
      time: { created: Date.now() - 60000, updated: Date.now(), archived: Date.now() },
    })
    const result2 = applyDirectoryEvent(draft, sessionUpdatedEvent(archivingSession))

    // THE BUG: Session is immediately removed, along with ALL its messages and parts
    expect(draft.session.find((s) => s.id === sesId)).toBeUndefined()
    // dropSessionCaches also clears all the session's data
    expect(draft.message[sesId]).toBeUndefined()
    expect(draft.sessionTotal).toBe(0)
  })

  test("SCENARIO 2: message.removed for the assistant message deletes it", () => {
    const sesId = "ses_1"
    const userMsgId = "msg_user_1" // sorts AFTER msg_ai_1 alphabetically
    const assistantMsgId = "msg_ai_1"
    const textPartId = "prt_text_1"

    // Build state by using the reducer to insert messages in sorted order
    let draft = makeState({
      session: [sessionInfo(sesId)],
      sessionTotal: 1,
      limit: 50,
      message: {
        [sesId]: [], // start empty so reducer inserts in sorted order
      },
      part: {},
      session_status: {
        [sesId]: { type: "idle" },
      },
    })

    // Insert user message via reducer (maintains sorted order)
    draft = structuredClone(draft)
    applyDirectoryEvent(draft, messageUpdatedEvent(msg(userMsgId, sesId, "user")))
    // Now manually add the assistant message via reducer
    draft = structuredClone(draft)
    applyDirectoryEvent(draft, messageUpdatedEvent(msg(assistantMsgId, sesId, "assistant")))
    // Add parts
    draft.part[assistantMsgId] = [part(textPartId, assistantMsgId, "text", "Hello, I can help you with that!")]

    // Verify the array is sorted (alphabetically: msg_ai_1 < msg_user_1)
    expect(draft.message[sesId]!.map((m) => m.id)).toEqual([assistantMsgId, userMsgId])

    // Apply message.removed event for the assistant message
    draft = structuredClone(draft)
    applyDirectoryEvent(draft, messageRemovedEvent(sesId, assistantMsgId))

    // THE BEHAVIOR: Assistant message is removed from the store
    expect(draft.message[sesId]?.find((m) => m.id === assistantMsgId)).toBeUndefined()
    // Parts are also deleted
    expect(draft.part[assistantMsgId]).toBeUndefined()
    // But the session still exists
    expect(draft.session.find((s) => s.id === sesId)).toBeDefined()
  })

  test("SCENARIO 3: message.updated arrives before part data triggers materialization race", () => {
    const sesId = "ses_1"
    const userMsgId = "msg_user_1"
    const assistantMsgId = "msg_ai_1"
    const textPartId = "prt_text_1"

    // Starting state: session has user message, no assistant message yet
    const state = makeState({
      session: [sessionInfo(sesId)],
      sessionTotal: 1,
      limit: 50,
      message: {
        [sesId]: [msg(userMsgId, sesId, "user")],
      },
      part: {},
      session_status: {
        [sesId]: { type: "busy" },
      },
    })

    let draft = structuredClone(state)

    // Step 1: message.updated event creates the assistant message (before parts arrive)
    const aiMsg = msg(assistantMsgId, sesId, "assistant")
    const result1 = applyDirectoryEvent(draft, messageUpdatedEvent(aiMsg))
    expect(typeof result1 === "boolean" ? result1 : result1.changed).toBe(true)

    // The message is created but has no parts yet (parts events haven't arrived)
    expect(draft.message[sesId]?.find((m) => m.id === assistantMsgId)).toBeDefined()
    expect(draft.part[assistantMsgId]).toBeUndefined()

    // Step 2: Parts arrive via SSE events (streaming starts)
    // This simulates the parts that should be preserved
    draft = structuredClone(draft)
    const textPartWithStreaming = part(textPartId, assistantMsgId, "text", "Hello, I ")
    // Add parts to simulate what SSE would deliver
    draft.part[assistantMsgId] = [textPartWithStreaming]
    
    // Step 3: Simulate materialization returning data WITHOUT the streaming part
    // (Materialization happens when the HTTP API response arrives and doesn't yet
    //  have the streaming message because the server hasn't persisted it)
    const materialized = materializeSessionSnapshots(
      { message: draft.message, part: draft.part },
      sesId,
      [
        {
          info: msg(userMsgId, sesId, "user"),
          parts: [],
        },
        // Note: assistant message is NOT in the server snapshot yet
        // because the streaming message hasn't been persisted to HTTP API
      ],
    )

    // The streaming part should be preserved
    const preservedParts = materialized.part[assistantMsgId]
    expect(preservedParts).toBeDefined()
    expect(preservedParts?.length).toBeGreaterThan(0)
    expect(preservedParts?.[0]?.id).toBe(textPartId)
    expect((preservedParts?.[0] as Part & { text?: string })?.text).toBe("Hello, I ")
    
    // OK: materialization preserves live streaming parts
    // SCENARIO 3 is actually SAFE regarding part preservation
  })

  test("SCENARIO 4: materialization with empty parts deletes parts entry", () => {
    const sesId = "ses_1"
    const userMsgId = "msg_user_1"
    const assistantMsgId = "msg_ai_1"
    const textPartId = "prt_text_1"

    const state = makeState({
      session: [sessionInfo(sesId)],
      sessionTotal: 1,
      limit: 50,
      message: {
        [sesId]: [
          msg(userMsgId, sesId, "user"),
          msg(assistantMsgId, sesId, "assistant"),
        ],
      },
      part: {
        [assistantMsgId]: [
          part(textPartId, assistantMsgId, "text", "hello world"),
        ],
      },
      session_status: {
        [sesId]: { type: "idle" },
      },
    })

    // Materialization returns the assistant message but with NO parts
    // (simulating server response where parts haven't been persisted yet)
    const materialized = materializeSessionSnapshots(
      { message: state.message, part: state.part },
      sesId,
      [
        {
          info: msg(userMsgId, sesId, "user"),
          parts: [],
        },
        {
          info: msg(assistantMsgId, sesId, "assistant"),
          parts: [], // <-- empty parts! The server snapshot has no parts for this message
        },
      ],
    )

    // THE KEY CHECK: Does the part survive when the server snapshot has
    // the message but returns zero parts for it?
    const afterParts = materialized.part[assistantMsgId]
    expect(afterParts).toBeDefined()
    expect(afterParts?.length).toBe(1)
    expect(afterParts?.[0]?.id).toBe(textPartId)
    // The streaming text should be preserved because mergeMaterializedParts
    // checks for hasLiveStreamingField and keeps the existing parts
  })

  test("SCENARIO 5: session is trimmed when limit is exceeded by new session creation", () => {
    const sesId = "ses_1" // The session the user is viewing
    const userMsgId = "msg_user_1"
    const assistantMsgId = "msg_ai_1"
    const textPartId = "prt_text_1"

    // State with strict limit: only 1 session allowed (low limit)
    const state = makeState({
      session: [
        sessionInfo("ses_0"),
        sessionInfo(sesId, { time: { created: Date.now(), updated: Date.now() } }),
      ],
      sessionTotal: 2,
      limit: 2, // Only 2 sessions allowed
      message: {
        [sesId]: [
          msg(userMsgId, sesId, "user"),
          msg(assistantMsgId, sesId, "assistant"),
        ],
      },
      part: {
        [assistantMsgId]: [part(textPartId, assistantMsgId, "text", "hello world")],
      },
      session_status: {
        [sesId]: { type: "busy" },
      },
    })

    let draft = structuredClone(state)

    // A new session is created, exceeding the limit of 2
    const newSession = sessionInfo("ses_new", { time: { created: Date.now(), updated: Date.now() } })
    const result = applyDirectoryEvent(draft, {
      type: "session.created",
      properties: { info: newSession },
    } as Event)

    expect(typeof result === "boolean" ? result : result.changed).toBe(true)

    // THE BUG: The oldest session (ses_0) should be trimmed, NOT ses_1
    // Verify ses_1 still exists
    expect(draft.session.find((s) => s.id === sesId)).toBeDefined()
    expect(draft.session.find((s) => s.id === "ses_0")).toBeUndefined()

    // OK: trimSession removes from the beginning (oldest by sorted ID)
    // ses_0 has an earlier id, so it gets trimmed first. ses_1 is preserved.
    // This is actually the correct behavior.
  })

  test("SCENARIO 6: session.updated with time.archived after session.idle (completion)", () => {
    // This simulates the most probable real-world scenario:
    // 1. User sends message → session goes busy
    // 2. AI starts streaming → parts arrive
    // 3. AI completes → session goes idle
    // 4. Server sends session.updated with time.archived → BUG: session disappears
    
    const sesId = "ses_1"
    const userMsgId = "msg_user_1"
    const assistantMsgId = "msg_ai_1"
    const textPartId = "prt_text_1"

    // Phase 1: Initial state with streaming response
    const state = makeState({
      session: [sessionInfo(sesId)],
      sessionTotal: 1,
      limit: 50,
      message: {
        [sesId]: [
          msg(userMsgId, sesId, "user"),
          msg(assistantMsgId, sesId, "assistant", Date.now()),
        ],
      },
      part: {
        [assistantMsgId]: [part(textPartId, assistantMsgId, "text", "Hello, I can help you!")],
      },
      session_status: {
        [sesId]: { type: "idle" },
      },
    })

    let draft = structuredClone(state)

    // Phase 2: Server sends session.updated with time.archived
    const archivedSession = sessionInfo(sesId, {
      time: { created: Date.now() - 60000, updated: Date.now(), archived: Date.now() },
    })
    applyDirectoryEvent(draft, sessionUpdatedEvent(archivedSession))

    // THE BUG: Session is removed from display
    expect(draft.session.find((s) => s.id === sesId)).toBeUndefined()
    
    // Note: session is completely gone from the directory store.
    // The messages and parts are still in the store (orphaned) but
    // the session entry itself is removed, so the sidebar and chat
    // view won't show it.
  })
})
