/**
 * Reproduction test for issue #1932:
 * First user message in a session loses trailing text after a leading slash command.
 *
 * Root cause: When a user types `/debug my symptom: import fails`, the client creates an
 * optimistic text part with the full text. The server echoes back a `message.part.updated`
 * event whose text field contains only the command name (`/debug`). The event reducer's
 * optimistic part replacement logic removes the full-text optimistic part and inserts the
 * truncated server part, losing the arguments.
 */

import { describe, expect, test } from "bun:test"
import type { Event } from "@opencode-ai/sdk/v2/client"
import { applyDirectoryEvent } from "../event-reducer"
import { INITIAL_STATE, type State } from "../types"

describe("issue 1932 — slash command echo truncation", () => {
  test("BUG: optimistic full text is replaced by truncated server echo (slash command)", () => {
    const messageID = "msg_1"
    const partID = "prt_1" // optimistic part ID
    const serverPartID = "prt_2" // server-issued part ID
    const fullText = "/debug my symptom: import fails on startup with ModuleNotFoundError"
    const truncatedText = "/debug" // server only echoes the command name

    const state = structuredClone(INITIAL_STATE) as State
    state.message = {}
    state.part = {}
    state.session_status = {}

    // Step 1: Insert the optimistic part as the client does before the server responds
    // The optimistic part has NO sessionID — this is the key property
    applyDirectoryEvent(state, {
      type: "message.part.updated",
      properties: {
        sessionID: "ses_1",
        part: {
          id: partID,
          messageID,
          type: "text",
          text: fullText,
        },
      },
    } as Event)

    // Verify the optimistic text is stored
    expect(state.part[messageID]).toBeTruthy()
    const optimisticPart = state.part[messageID]![0] as Record<string, unknown>
    expect(optimisticPart.id).toBe(partID)
    expect(optimisticPart.text).toBe(fullText)
    // Optimistic parts don't have a sessionID field
    expect(optimisticPart.sessionID).toBeFalsy()

    // Step 2: Server echoes back a part with sessionID but truncated text (only the command)
    // This simulates OpenCode's server response to POST /session/{id}/command
    applyDirectoryEvent(state, {
      type: "message.part.updated",
      properties: {
        part: {
          id: serverPartID,
          messageID,
          sessionID: "ses_1",
          type: "text",
          text: truncatedText,
        },
      },
    } as Event)

    // BUG: The text should be the full text, but it's truncated to just "/debug"
    const finalPart = state.part[messageID]![0] as Record<string, unknown>
    expect(state.part[messageID]).toHaveLength(1)

    // This demonstrates the bug — the trailing text is lost:
    expect(finalPart.text).toBe(truncatedText)
    // The full text was replaced instead of preserved:
    expect(finalPart.text).not.toBe(fullText)
  })

  test("normal prompt (no slash command) preserves full text properly", () => {
    const messageID = "msg_2"
    const partID = "prt_1"
    const serverPartID = "prt_2"
    const fullText = "What is the capital of France?"

    const state = structuredClone(INITIAL_STATE) as State
    state.message = {}
    state.part = {}
    state.session_status = {}

    // Optimistic part with full text
    applyDirectoryEvent(state, {
      type: "message.part.updated",
      properties: {
        sessionID: "ses_1",
        part: { id: partID, messageID, type: "text", text: fullText },
      },
    } as Event)

    // Server echoes back the same full text
    applyDirectoryEvent(state, {
      type: "message.part.updated",
      properties: {
        part: { id: serverPartID, messageID, sessionID: "ses_1", type: "text", text: fullText },
      },
    } as Event)

    const finalPart = state.part[messageID]![0] as Record<string, unknown>
    expect(finalPart.text).toBe(fullText)
  })
})
