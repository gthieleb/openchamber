/**
 * Reproduction test for Issue #1581: Sidebar worktree label is stale after external branch switch.
 *
 * Root cause: `ensureStatus` (and therefore `fetchStatus`) is only called for project root
 * directories — NOT for worktree directories. This means that when a user switches a worktree's
 * branch externally (e.g., `git switch other-branch` in the worktree), the sidebar worktree
 * group label continues showing the old branch because the cached `status.current` in the
 * git store is never refreshed for worktree directories.
 *
 * Relevant code paths:
 * - `useProjectRepoStatus` (sidebar/hooks/useProjectRepoStatus.ts, line 36) calls
 *   `ensureStatus` only for `project.normalizedPath` (project roots).
 * - `useRightSidebarGitSync` (layout/RightSidebarTabs.tsx, line 31) polls `ensureStatus`
 *   only for the active project directory, and only when the right sidebar is open.
 * - `useSessionGrouping` (sidebar/hooks/useSessionGrouping.ts, line 201) reads branch info
 *   from `args.gitBranches.get(directory)`, which comes from `useGitAllBranches()`.
 * - `useGitAllBranches` (useGitStore.ts, line 1018) returns a map of ALL directories' branch
 *   names from the store's `directories` map — but the map is only updated when `fetchStatus`
 *   is called for a directory, which never happens for worktrees outside of explicit tool calls.
 * - `useGitStore.fetchStatus` (useGitStore.ts, line 403) stores the result in
 *   `directories.get(directory).status.current`, and `useGitAllBranches` reads from that.
 */

import { beforeEach, describe, expect, test } from 'bun:test';
import type { GitStatus } from '@/lib/api/types';
import { useGitStore } from './useGitStore';

// Use the same simplified GitAPI type as the existing test (useGitStore.test.ts)
type GitAPI = Parameters<ReturnType<typeof useGitStore.getState>['fetchStatus']>[1];

interface FetchCall {
  directory: string;
  timestamp: number;
}

const createStatus = (branch: string, isClean = true): GitStatus => ({
  current: branch,
  tracking: null,
  ahead: 0,
  behind: 0,
  files: [],
  isClean,
});

/**
 * Creates a minimal mock GitAPI. Only provides the methods the store actually
 * calls: checkIsGitRepository, getGitStatus, getGitBranches, getGitLog,
 * getCurrentGitIdentity, getGitFileDiff.
 */
const createMockGit = (
  callLog: FetchCall[],
  statusFn: (dir: string) => GitStatus = () => createStatus('main'),
): GitAPI => ({
  getGitStatus: async (directory: string) => {
    callLog.push({ directory, timestamp: Date.now() });
    return statusFn(directory);
  },
  checkIsGitRepository: async () => true,
  getGitBranches: async () => ({ all: [], current: 'main', branches: {} }),
  getGitLog: async () => ({ all: [], latest: null, total: 0 }),
  getCurrentGitIdentity: async () => null,
  getGitFileDiff: async () => ({ original: '', modified: '', path: '' }),
});

/**
 * Reads the current branch map from the store, mirroring the logic of
 * `useGitAllBranches` (useGitStore.ts line 1018) for sync testing.
 */
function getAllBranches(): Map<string, string | null> {
  const state = useGitStore.getState();
  const result = new Map<string, string | null>();
  for (const [dir, dirState] of state.directories) {
    result.set(dir, dirState.status?.current ?? null);
  }
  return result;
}

describe('Issue #1581: Stale worktree branch label', () => {
  beforeEach(() => {
    useGitStore.setState({
      directories: new Map(),
      activeDirectory: null,
    });
  });

  test('ensureStatus is NOT called for worktree directories (the bug)', async () => {
    // Simulate what useProjectRepoStatus does: it only calls ensureStatus for project roots.
    // We have a project at /repo with a worktree at /repo-wt.
    const projectRoot = '/repo';
    const worktreeDir = '/repo-wt';

    const callLog: FetchCall[] = [];

    const mockGit = createMockGit(callLog, (dir) => {
      if (dir === projectRoot) return createStatus('main');
      if (dir === worktreeDir) return createStatus('feature/x');
      return createStatus('unknown');
    });

    const store = useGitStore.getState();

    // Call ensureStatus for the project root only
    // (This mirrors useProjectRepoStatus.ts line 34-38)
    await store.ensureStatus(projectRoot, mockGit);

    // EnsureStatus should have called getGitStatus for the project root
    const rootCalls = callLog.filter((c) => c.directory === projectRoot);
    expect(rootCalls.length).toBe(1);

    // Worktree directory was NOT fetched — this is the bug
    const worktreeCalls = callLog.filter((c) => c.directory === worktreeDir);
    expect(worktreeCalls.length).toBe(0);
  });

  test('worktree branch label shows old branch after external switch — no auto-refresh', async () => {
    const projectRoot = '/repo';
    const worktreeDir = '/repo-wt';

    const callLog: FetchCall[] = [];

    // Mock git returns the OLD branch for the worktree
    let worktreeBranch = 'feature/old-branch';
    const mockGit = createMockGit(callLog, (dir) => {
      if (dir === projectRoot) return createStatus('main');
      if (dir === worktreeDir) return createStatus(worktreeBranch);
      return createStatus('unknown');
    });

    const store = useGitStore.getState();

    // Step 1: Fetch status for both directories (initial load)
    await store.fetchStatus(projectRoot, mockGit);
    await store.fetchStatus(worktreeDir, mockGit);

    // Verify initial branch is correct
    const initialBranches = getAllBranches();
    expect(initialBranches.get(projectRoot)).toBe('main');
    expect(initialBranches.get(worktreeDir)).toBe('feature/old-branch');

    // Step 2: Simulate external branch switch — user runs `git switch feature/new-branch` in the worktree
    worktreeBranch = 'feature/new-branch';

    // Step 3: Simulate what the sidebar does — it only calls ensureStatus for the project root,
    // not for the worktree. This is what useProjectRepoStatus does in practice.
    callLog.length = 0;
    // Since we just fetched, ensureStatus will skip due to STATUS_STALE_THRESHOLD (5s).
    // But even if it didn't skip, it only refreshes the project root, not the worktree.
    await store.ensureStatus(projectRoot, mockGit);

    // Step 4: Read the branch via getAllBranches — the worktree branch is still the OLD one
    const branchesAfterExternalSwitch = getAllBranches();
    expect(branchesAfterExternalSwitch.get(worktreeDir)).toBe('feature/old-branch');
    // The worktree branch label in the sidebar is STALE!
    // It should be 'feature/new-branch' but it's still 'feature/old-branch'.
    // No auto-refresh mechanism exists for worktree directories.
  });

  test('manual fetchStatus for worktree directory resolves the staleness', async () => {
    const projectRoot = '/repo';
    const worktreeDir = '/repo-wt';

    const callLog: FetchCall[] = [];

    // Setup: initial branch
    let worktreeBranch = 'feature/old-branch';
    const mockGit: GitAPI = createMockGit(callLog, (dir) => {
      if (dir === projectRoot) return createStatus('main');
      if (dir === worktreeDir) return createStatus(worktreeBranch);
      return createStatus('unknown');
    });

    const store = useGitStore.getState();

    // Initial fetch for both
    await store.fetchStatus(projectRoot, mockGit);
    await store.fetchStatus(worktreeDir, mockGit);

    const initialBranches = getAllBranches();
    expect(initialBranches.get(worktreeDir)).toBe('feature/old-branch');

    // External switch
    worktreeBranch = 'feature/new-branch';

    // Simulate a manual refresh for the worktree (what the user does by reloading,
    // or what should happen automatically but doesn't)
    await store.fetchStatus(worktreeDir, mockGit);

    const branchesAfterRefresh = getAllBranches();
    expect(branchesAfterRefresh.get(worktreeDir)).toBe('feature/new-branch');
    // After manual fetchStatus for the worktree, the branch is correct.
    // This proves a refresh would fix it, but it's never triggered automatically.
  });
});
