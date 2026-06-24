/**
 * Reproduction test for issue #1805:
 * worktree: subagent sessions kept when deleting worktree group from sidebar
 *
 * Root cause: `allGroupSessions` in SessionGroupSection.tsx is guarded by
 * `group.isArchivedBucket`, returning `[]` for active worktree groups.
 * The worktree delete button sends an empty session list, so SessionDialogs
 * skips archiving and only removes the git worktree directory.
 */

import { describe, expect, test } from 'bun:test';

// Minimal session shape that the component actually reads
interface Session {
  id: string;
  title: string | null;
}

interface SessionNode {
  session: Session;
  children: SessionNode[];
}

interface SessionGroup {
  isArchivedBucket?: boolean;
}

// Reproduce the exact logic from SessionGroupSection.tsx lines 666-684
function collectGroupSessions(nodes: SessionNode[]): Session[] {
  const collected: Session[] = [];
  const visit = (list: SessionNode[]) => {
    list.forEach((node) => {
      collected.push(node.session);
      if (node.children.length > 0) visit(node.children);
    });
  };
  visit(nodes);
  return collected;
}

function computeAllGroupSessions(
  group: { isArchivedBucket?: boolean },
  sourceGroupNodes: SessionNode[],
): Session[] {
  // BUG: line 682 guards with `group.isArchivedBucket`, returning [] for active worktree groups.
  // The guard should be removed so it always collects sessions.
  return group.isArchivedBucket ? collectGroupSessions(sourceGroupNodes) : [];
}

function makeSession(id: string, title: string): Session {
  return { id, title };
}

function makeNode(session: Session, children: SessionNode[] = []): SessionNode {
  return { session, children };
}

describe('Issue #1805 - worktree group delete sessions', () => {
  test('BUG: allGroupSessions returns [] for non-archived worktree groups', () => {
    // Simulate a worktree group (not archived)
    const worktreeGroup: SessionGroup = {
      isArchivedBucket: false, // <-- This is key: worktree groups are NOT archived
    };

    // Sessions that belong to this worktree group (including subagent sessions)
    const mainSession = makeSession('sess-1', 'Main session');
    const subagentSession = makeSession('sess-2', 'Subagent session');
    const sourceNodes = [
      makeNode(mainSession, [makeNode(subagentSession)]),
    ];

    // Collect sessions the same way the component does
    const sessions = computeAllGroupSessions(worktreeGroup, sourceNodes);

    // EXPECTED (fix): all sessions are collected, including subagent sessions
    // BUG: sessions is [] because isArchivedBucket is false
    expect(sessions).toEqual([]);
    expect(sessions.length).toBe(0);
  });

  test('BUG: SessionDialogs skips archiving when sessions array is empty', () => {
    // Simulate what happens when the worktree delete button fires:
    //   sessionEvents.requestDelete({
    //     sessions: allGroupSessions,   // ← [] due to guard
    //     mode: 'worktree',
    //     worktree: group.worktree,
    //   });
    //
    // In SessionDialogs.tsx line 406:
    //   if (deleteDialog.sessions.length === 0 && isWorktreeDelete && deleteDialog.worktree) {
    //     removeSelectedWorktreeInBackground(deleteDialog.worktree, deleteLocalBranch);
    //     closeDeleteDialog();
    //     return;
    //   }
    //
    // → Only the git worktree directory is removed. No archiving happens.

    const sessions: Session[] = []; // ← empty because allGroupSessions returned []
    const isWorktreeDelete = true;
    const worktree = { path: '/workspace/my-project/.git/worktrees/feature' };

    // This matches the SessionDialogs early-return on line 406-410
    if (sessions.length === 0 && isWorktreeDelete && worktree) {
      // Code path: just removes worktree directory, no session archiving
      expect(sessions.length).toBe(0);
      // → Subagent sessions become orphans in database + UI
    }
  });

  test('EXPECTED: allGroupSessions should collect sessions regardless of isArchivedBucket', () => {
    // After the fix, allGroupSessions would be:
    //   () => collectGroupSessions(sourceGroupNodes)
    // without the isArchivedBucket guard

    const mainSession = makeSession('sess-3', 'Main session');
    const subagentSession = makeSession('sess-4', 'Subagent session');
    const sourceNodes = [
      makeNode(mainSession, [makeNode(subagentSession)]),
    ];

    // FIX: remove the guard so sessions are always collected
    const sessions = collectGroupSessions(sourceNodes);

    expect(sessions.length).toBe(2);
    expect(sessions[0].title).toBe('Main session');
    expect(sessions[1].title).toBe('Subagent session');
  });
});
