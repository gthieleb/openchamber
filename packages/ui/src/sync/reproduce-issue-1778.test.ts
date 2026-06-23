/**
 * Reproduction test for issue #1778
 *
 * Demonstrates the race condition where `fetchMessagesForSession` is called
 * before `setActionRefs` sets the module-level `_sdk` reference.
 *
 * ## Root Cause
 *
 * The initialization sequence in `SyncProvider` (sync-context.tsx) uses
 * multiple `useEffect` hooks:
 *
 *   1. Configure child stores & bootstrap (line 1642)
 *   2. Create event pipeline (line 1783)
 *   3. Bootstrap global state (line 1755)
 *   4. Ensure child store exists (line 1986)
 *   5. **Set SDK refs** (line 2019–2029) — calls `setActionRefs(props.sdk, ...)`
 *   6. Subscribe to streaming state (line 2032)
 *
 * In React, child effects run BEFORE parent effects (bottom-up). Since
 * `SyncProvider` is a wrapper component, components nested inside it (e.g.
 * `MiniChatBootstrap`, `MainLayout`) mount their effects first. Those
 * components may call `setCurrentSession()` (session-ui-store.ts:470), which
 * fires `fetchMessagesForSession()` (session-actions.ts:1058) as a
 * fire-and-forget promise. That function calls `sdk()` (session-actions.ts:107),
 * which reads the module-level `_sdk` variable — still `null` because
 * `setActionRefs` hasn't run yet (it's scheduled in a later effect phase).
 *
 * ## Timeline
 *   T0: SyncProvider renders — refs created, children render
 *   T1: Children mount — effects fire
 *   T2: MiniChatBootstrap/MainLayout/useRouter effect → setCurrentSession()
 *   T3: setCurrentSession → fetchMessagesForSession() → sdk() → throws  ❌
 *   T4: SyncProvider effects fire → setActionRefs() → sets _sdk           ✅ (too late)
 *
 * ## Error
 *   Error: SDK not initialized — is SyncProvider mounted?
 *   at sdk (session-actions.ts:108)
 *   at fetchMessagesForSession (session-actions.ts:1062)
 *   at setCurrentSession (session-ui-store.ts:505)
 *
 * ## Affected paths
 *   - MiniChatBootstrap (ElectronMiniChatApp.tsx:140) calls setCurrentSession
 *     in a useEffect — fires before SyncProvider's setActionRefs effect
 *   - useRouter initialization (useRouter.ts:63) calls setCurrentSession
 *     in a useEffect — runs after SyncProvider's effects (App is parent),
 *     but can still race if child components call setCurrentSession earlier
 *   - SessionSidebar click handlers call setCurrentSession imperatively — not
 *     subject to this race (they run after mount), but the first call during
 *     startup restoration hits it.
 *
 * NOTE: Bun caches dynamic imports (`await import()`) across tests in the
 * same file. Tests are ordered so that the "uninitialized" test runs first
 * (before any setActionRefs call), and the "initialized" test runs second.
 */

import { describe, expect, test, mock } from "bun:test"
import type { OpencodeClient } from "@opencode-ai/sdk/v2/client"

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

function createChildStores() {
  return {
    children: new Map(),
    ensureChild: () => ({
      getState: () => ({
        session: [],
        message: {},
        part: {},
        session_status: {},
        status: "loaded" as const,
        config: {},
      }),
      setState: mock(() => {}),
      subscribe: () => () => {},
    }),
    getChild: () => null,
    configure: () => {},
  } as unknown as import("./child-store").ChildStoreManager
}

// ---------------------------------------------------------------------------
// The reproduction
// ---------------------------------------------------------------------------

describe("Issue #1778 — SDK not initialized race", () => {
  test("[1/2] fetchMessagesForSession throws when _sdk is null (before setActionRefs)", async () => {
    /**
     * THIS test must run FIRST before any setActionRefs call in this file.
     * Bun caches dynamic imports so the module-level `_sdk` starts as null.
     */
    const sessionActions = await import("./session-actions")

    // Without calling setActionRefs first, _sdk is null → sdk() throws
    await expect(
      sessionActions.fetchMessagesForSession("test-session-id", "/test/dir"),
    ).rejects.toThrow("SDK not initialized — is SyncProvider mounted?")
  })

  test("[2/2] setActionRefs before fetchMessagesForSession works correctly", async () => {
    /**
     * THIS test must run SECOND. After test 1, _sdk is still null
     * (test 1 threw before setting it). We set _sdk here and verify.
     */
    const sessionActions = await import("./session-actions")
    const mockSdk = {
      session: {
        messages: mock(() => Promise.resolve({ data: [] })),
      },
    } as unknown as OpencodeClient

    // Set the SDK ref first (as SyncProvider's effect should do)
    sessionActions.setActionRefs(mockSdk, createChildStores(), () => "/test/dir")

    // Now fetchMessagesForSession should succeed
    const result = await sessionActions.fetchMessagesForSession(
      "test-session-id",
      "/test/dir",
    )
    expect(result).toBeUndefined()
  })
})
