/**
 * Reproduction test for issue #1804:
 * First click on a session inside a worktree group sometimes doesn't select the session.
 *
 * This test simulates the exact data flow and demonstrates that the
 * `useProjectSessionSelection` layout effect can override the user's
 * intended session selection when worktree sessions are involved.
 *
 * The hypothesis: when `handleSessionSelect` calls `setActiveProjectIdOnly(projectId)`,
 * `setDirectory(sessionDirectory)`, and `setCurrentSession(sessionId)` in sequence,
 * the `useProjectSessionSelection` layout effect re-runs with `projectSessionMeta`
 * derived from `projectSections`. If the worktree session isn't yet present in
 * `projectSessionMeta` (because `projectSections` was computed without that
 * worktree's sessions), the effect falls through to `handleSessionSelect(targetSessionId)`
 * where `targetSessionId` is the project's first session — NOT the one the user clicked.
 *
 * See: packages/ui/src/components/session/sidebar/hooks/useProjectSessionSelection.ts:84-153
 * See: packages/ui/src/components/session/sidebar/hooks/useSessionActions.ts:66-101
 */
import { describe, expect, test, beforeEach, mock } from 'bun:test';

// =============================================================================
// Data types (subset needed for the reproduction)
// =============================================================================

type Session = {
  id: string;
  title?: string | null;
  directory?: string | null;
  time?: { archived?: boolean | null; updated?: string | null; created?: string | null } | null;
  parentID?: string | null;
};

type SessionNode = {
  session: Session;
  children: SessionNode[];
  worktree?: { path?: string | null } | null;
};

type SessionGroup = {
  id: string;
  label: string;
  isMain: boolean;
  directory: string | null;
  sessions: SessionNode[];
  worktree?: { path?: string | null } | null;
};

type ProjectSection = {
  project: { id: string; normalizedPath: string };
  groups: SessionGroup[];
};

type ProjectEntry = {
  id: string;
  path: string;
  normalizedPath: string;
  lastOpenedAt?: number;
};

type WorktreeMetadata = {
  path: string;
  label?: string | null;
  branch?: string | null;
  name?: string | null;
  projectDirectory?: string | null;
};

// =============================================================================
// Slice of the production logic under test
// =============================================================================

/** Normalize a path for comparison (production code in utils.ts) */
const normalizePath = (value: string | null): string | null => {
  if (!value) return null;
  return value.replace(/\\/g, '/').replace(/\/+$/, '').replace(/\/+/g, '/');
};

/** Project resolution (subset of projectResolution.ts) */
const resolveProjectForDirectory = (
  projects: ProjectEntry[],
  directory: string | null,
): ProjectEntry | null => {
  const nd = normalizePath(directory);
  if (!nd) return null;
  let best: ProjectEntry | null = null;
  for (const p of projects) {
    const pp = normalizePath(p.path);
    if (!pp) continue;
    if (nd !== pp && !nd.startsWith(`${pp}/`)) continue;
    if (!best || pp.length > (normalizePath(best.path)?.length ?? 0)) best = p;
  }
  return best;
};

const resolveProjectFromWorktreeDirectory = (
  projects: ProjectEntry[],
  availableWorktreesByProject: Map<string, WorktreeMetadata[]>,
  directory: string | null,
): ProjectEntry | null => {
  const nd = normalizePath(directory);
  if (!nd) return null;
  let matchedWorktree: WorktreeMetadata | null = null;
  let matchedProjectPath: string | null = null;
  let bestLen = -1;
  for (const [projectPath, worktrees] of availableWorktreesByProject.entries()) {
    for (const wt of worktrees) {
      const wp = normalizePath(wt.path);
      if (!wp) continue;
      if (nd !== wp && !nd.startsWith(`${wp}/`)) continue;
      if (wp.length > bestLen) {
        bestLen = wp.length;
        matchedWorktree = wt;
        matchedProjectPath = normalizePath(projectPath);
      }
    }
  }
  if (!matchedWorktree) return null;
  const candidates = [
    matchedWorktree.projectDirectory ? normalizePath(matchedWorktree.projectDirectory) : null,
    matchedProjectPath,
  ].filter((v): v is string => Boolean(v));
  for (const c of candidates) {
    const exact = projects.find((p) => normalizePath(p.path) === c) ?? null;
    if (exact) return exact;
    const nested = resolveProjectForDirectory(projects, c);
    if (nested) return nested;
  }
  return null;
};

const resolveProjectForSessionDirectory = (
  projects: ProjectEntry[],
  availableWorktreesByProject: Map<string, WorktreeMetadata[]>,
  directory: string | null,
): ProjectEntry | null =>
  resolveProjectFromWorktreeDirectory(projects, availableWorktreesByProject, directory) ??
  resolveProjectForDirectory(projects, directory);

/**
 * Build the projectSessionMeta map (subset of useProjectSessionSelection.ts:42-80).
 * Returns:
 * - metaByProject: projectId → Map<sessionId, { directory }>
 * - firstSessionByProject: projectId → { id, directory }
 */
const buildProjectSessionMeta = (projectSections: ProjectSection[]) => {
  const metaByProject = new Map<string, Map<string, { directory: string | null }>>();
  const firstSessionByProject = new Map<string, { id: string; directory: string | null }>();

  const visitNodes = (
    projectId: string,
    projectRoot: string,
    fallbackDirectory: string | null,
    nodes: SessionNode[],
  ) => {
    if (!metaByProject.has(projectId)) {
      metaByProject.set(projectId, new Map());
    }
    const projectMap = metaByProject.get(projectId)!;
    nodes.forEach((node) => {
      const sessionDirectory = normalizePath(
        node.worktree?.path
          ?? (node.session as Session & { directory?: string | null }).directory
          ?? fallbackDirectory
          ?? projectRoot,
      );
      projectMap.set(node.session.id, { directory: sessionDirectory });
      if (!firstSessionByProject.has(projectId)) {
        firstSessionByProject.set(projectId, { id: node.session.id, directory: sessionDirectory });
      }
      if (node.children.length > 0) {
        visitNodes(projectId, projectRoot, sessionDirectory, node.children);
      }
    });
  };

  projectSections.forEach((section) => {
    section.groups.forEach((group) => {
      visitNodes(section.project.id, section.project.normalizedPath, group.directory, group.sessions);
    });
  });

  return { metaByProject, firstSessionByProject };
};

/**
 * Simulate the useProjectSessionSelection layout effect logic.
 * This is the core of the bug reproduction.
 */
const simulateLayoutEffect = (
  activeProjectId: string | null,
  currentSessionId: string | null,
  projectSections: ProjectSection[],
  projectSessionMeta: ReturnType<typeof buildProjectSessionMeta>,
  activeSessionByProject: Map<string, string>,
): { action: 'persist' | 'open-draft' | 'navigate-to'; targetSessionId?: string } => {
  if (!activeProjectId) return { action: 'persist' };

  const section = projectSections.find((item) => item.project.id === activeProjectId);
  if (!section) return { action: 'persist' };

  const projectMap = projectSessionMeta.metaByProject.get(activeProjectId);

  // Path A: currentSessionId is valid for this project
  if (currentSessionId && projectMap && projectMap.has(currentSessionId)) {
    return { action: 'persist' };
  }

  // Path B: project has no sessions
  if (!projectMap || projectMap.size === 0) {
    return { action: 'open-draft' };
  }

  // Path C: resolve target session (remembered or first)
  const rememberedSessionId = activeSessionByProject.get(activeProjectId);
  const remembered = rememberedSessionId && projectMap.has(rememberedSessionId)
    ? rememberedSessionId
    : null;
  const fallback = projectSessionMeta.firstSessionByProject.get(activeProjectId)?.id ?? null;
  const targetSessionId = remembered ?? fallback;
  if (!targetSessionId || targetSessionId === currentSessionId) {
    return { action: 'persist' };
  }

  return { action: 'navigate-to', targetSessionId };
};

// =============================================================================
// Tests
// =============================================================================

describe('Issue #1804: Worktree session first-click selection', () => {
  // --- Test data setup ---

  const PROJECT_A: ProjectEntry = {
    id: 'proj-a',
    path: '/home/user/my-project',
    normalizedPath: '/home/user/my-project',
  };

  const PROJECT_B: ProjectEntry = {
    id: 'proj-b',
    path: '/home/user/other-project',
    normalizedPath: '/home/user/other-project',
  };

  const WORKTREE_DIR = '/home/user/my-project-worktree';

  const ROOT_SESSION_A: Session = {
    id: 'root-session-a',
    title: 'Root Session A',
    directory: '/home/user/my-project',
  };

  const ROOT_SESSION_B: Session = {
    id: 'root-session-b',
    title: 'Root Session B',
    directory: '/home/user/other-project',
  };

  const WORKTREE_SESSION_1: Session = {
    id: 'worktree-session-1',
    title: 'Worktree Session 1',
    directory: WORKTREE_DIR,
  };

  const WORKTREE_SESSION_2: Session = {
    id: 'worktree-session-2',
    title: 'Worktree Session 2',
    directory: WORKTREE_DIR,
  };

  // Worktree metadata
  const worktreeMetadata: WorktreeMetadata = {
    path: WORKTREE_DIR,
    label: 'my-feature-branch',
    branch: 'feature/my-feature',
    projectDirectory: PROJECT_A.path,
  };

  // Build the sidebar sections as they would appear in production
  const buildProjectSections = (includeWorktree: boolean): ProjectSection[] => {
    const rootGroupA: SessionGroup = {
      id: 'root',
      label: 'Project Root',
      isMain: true,
      directory: PROJECT_A.normalizedPath,
      sessions: [
        { session: ROOT_SESSION_A, children: [] },
      ],
    };

    const rootGroupB: SessionGroup = {
      id: 'root',
      label: 'Project Root',
      isMain: true,
      directory: PROJECT_B.normalizedPath,
      sessions: [
        { session: ROOT_SESSION_B, children: [] },
      ],
    };

    const groupsA: SessionGroup[] = [rootGroupA];
    const groupsB: SessionGroup[] = [rootGroupB];

    if (includeWorktree) {
      const worktreeGroup: SessionGroup = {
        id: `worktree:${WORKTREE_DIR}`,
        label: 'my-feature-branch',
        isMain: false,
        directory: WORKTREE_DIR,
        worktree: worktreeMetadata,
        sessions: [
          { session: WORKTREE_SESSION_1, children: [], worktree: worktreeMetadata },
          { session: WORKTREE_SESSION_2, children: [], worktree: worktreeMetadata },
        ],
      };
      groupsA.push(worktreeGroup);
    }

    return [
      { project: { id: PROJECT_A.id, normalizedPath: PROJECT_A.normalizedPath }, groups: groupsA },
      { project: { id: PROJECT_B.id, normalizedPath: PROJECT_B.normalizedPath }, groups: groupsB },
    ];
  };

  const activeSessionByProject = new Map<string, string>();

  let callSequence: string[];

  beforeEach(() => {
    activeSessionByProject.clear();
    activeSessionByProject.set(PROJECT_B.id, ROOT_SESSION_B.id);
    callSequence = [];
  });

  // ======== Test 1: Click on a root session in a different project ========
  test('click on root session in different project selects it correctly', () => {
    const projectSections = buildProjectSections(true);
    const projectSessionMeta = buildProjectSessionMeta(projectSections);

    // Simulate: user is on Project B, clicks Root Session A in Project A
    const clickedSessionId = ROOT_SESSION_A.id;
    const clickedProjectId = PROJECT_A.id;

    // Step 1: handleSessionSelect would call setActiveProjectIdOnly + setCurrentSession
    const activeProjectId = clickedProjectId;
    const currentSessionId = clickedSessionId;

    // Step 2: layout effect runs
    const result = simulateLayoutEffect(
      activeProjectId,
      currentSessionId,
      projectSections,
      projectSessionMeta,
      activeSessionByProject,
    );

    // Expected: Path A (persist) since the clicked session IS in the project
    expect(result.action).toBe('persist');
  });

  // ======== Test 2: Click on a worktree session ========
  test('click on worktree session in different project selects it correctly (with worktree in data)', () => {
    const projectSections = buildProjectSections(true);
    const projectSessionMeta = buildProjectSessionMeta(projectSections);

    // Simulate: user is on Project B, clicks Worktree Session 1 in Project A's worktree
    const clickedSessionId = WORKTREE_SESSION_1.id;
    const clickedProjectId = PROJECT_A.id;

    // Step 1: handleSessionSelect calls setActiveProjectIdOnly + setCurrentSession
    const activeProjectId = clickedProjectId;
    const currentSessionId = clickedSessionId;

    // Verify the session is in projectSessionMeta
    const projectMap = projectSessionMeta.metaByProject.get(PROJECT_A.id)!;
    expect(projectMap.has(WORKTREE_SESSION_1.id)).toBe(true);
    expect(projectMap.has(WORKTREE_SESSION_2.id)).toBe(true);

    // Step 2: layout effect runs
    const result = simulateLayoutEffect(
      activeProjectId,
      currentSessionId,
      projectSections,
      projectSessionMeta,
      activeSessionByProject,
    );

    // Expected: Path A (persist) since the worktree session IS in the project's meta
    expect(result.action).toBe('persist');
  });

  // ======== Test 3: THE BUG - worktree not yet in projectSections ========
  test('click on worktree session FAILS when worktree is not yet in projectSections', () => {
    // CRITICAL: projectSections is built WITHOUT the worktree group
    // This simulates the scenario where availableWorktreesByProject hasn't been
    // populated yet when projectSections was last computed
    const projectSectionsWithoutWorktree = buildProjectSections(false);
    const projectSessionMeta = buildProjectSessionMeta(projectSectionsWithoutWorktree);

    // Simulate: user is on Project B, clicks Worktree Session 1
    // (which is visible because the UI re-rendered with worktree data,
    // but projectSessionMeta was computed FROM A STALE projectSections)
    const clickedSessionId = WORKTREE_SESSION_1.id;
    const clickedProjectId = PROJECT_A.id;

    // After handleSessionSelect runs:
    const activeProjectId = clickedProjectId;
    const currentSessionId = clickedSessionId;

    // Verify: the worktree sessions are NOT in projectSessionMeta
    const projectMap = projectSessionMeta.metaByProject.get(PROJECT_A.id)!;
    expect(projectMap.has(WORKTREE_SESSION_1.id)).toBe(false);
    expect(projectMap.has(WORKTREE_SESSION_2.id)).toBe(false);
    // Only root session A is in the map
    expect(projectMap.has(ROOT_SESSION_A.id)).toBe(true);

    // Step 2: layout effect runs
    const result = simulateLayoutEffect(
      activeProjectId,
      currentSessionId,
      projectSectionsWithoutWorktree,
      projectSessionMeta,
      activeSessionByProject,
    );

    // BUG REPRODUCED: The effect does NOT persist the clicked session.
    // Instead, it resolves to the FIRST session in Project A (Root Session A).
    expect(result.action).toBe('navigate-to');
    expect(result.targetSessionId).toBe(ROOT_SESSION_A.id);
    // Should have been WORKTREE_SESSION_1.id but the worktree wasn't in projectSections
    expect(result.targetSessionId).not.toBe(clickedSessionId);
  });

  // ======== Test 4: Second click works (meta already computed) ========
  test('second click on worktree session succeeds after meta is rebuilt', () => {
    // First, build projectSections WITHOUT worktree (stale data)
    const staleSections = buildProjectSections(false);
    const staleMeta = buildProjectSessionMeta(staleSections);

    // First click fails (as shown in test 3)
    const firstClickResult = simulateLayoutEffect(
      PROJECT_A.id,
      WORKTREE_SESSION_1.id,
      staleSections,
      staleMeta,
      activeSessionByProject,
    );
    expect(firstClickResult.action).toBe('navigate-to');
    expect(firstClickResult.targetSessionId).toBe(ROOT_SESSION_A.id);

    // Now projectSections is rebuilt WITH worktree data
    const freshSections = buildProjectSections(true);
    const freshMeta = buildProjectSessionMeta(freshSections);

    // Second click on the same worktree session
    const secondClickResult = simulateLayoutEffect(
      PROJECT_A.id,
      WORKTREE_SESSION_1.id,
      freshSections,
      freshMeta,
      activeSessionByProject,
    );

    // Second click succeeds
    expect(secondClickResult.action).toBe('persist');
  });

  // ======== Test 5: Verify firstSessionByProject behavior ========
  test('firstSessionByProject points to root session when worktree is missing', () => {
    // Without worktree
    const withoutWt = buildProjectSections(false);
    const metaWithoutWt = buildProjectSessionMeta(withoutWt);

    const firstWithoutWorktree = metaWithoutWt.firstSessionByProject.get(PROJECT_A.id);
    expect(firstWithoutWorktree?.id).toBe(ROOT_SESSION_A.id);

    // With worktree (first session might be worktree session depending on grouping order)
    const withWt = buildProjectSections(true);
    const metaWithWt = buildProjectSessionMeta(withWt);

    const firstWithWorktree = metaWithWt.firstSessionByProject.get(PROJECT_A.id);
    // The first session is determined by the iteration order of groups
    // Root group comes first (isMain: true), so first session is root session A
    expect(firstWithWorktree?.id).toBe(ROOT_SESSION_A.id);
  });

  // ======== Test 6: Simulate the exact bug scenario ========
  test('complete reproduction: first-click-no-op via stale projectSessionMeta', () => {
    // This test simulates the full lifecycle of the bug:
    //
    // 1. User is on Project B
    // 2. availableWorktreesByProject is populated asynchronously
    // 3. Worktree group appears in sidebar
    // 4. User clicks on a session in the worktree group
    // 5. Click handler calls: setActiveProjectIdOnly(PROJECT_A.id) + setDirectory(worktreeDir) + setCurrentSession(WORKTREE_SESSION_1.id)
    // 6. React re-renders, but projectSessionMeta was computed from projectSections
    //    that was built BEFORE availableWorktreesByProject was updated — or more precisely,
    //    projectSections is stable across renders because none of its deps changed,
    //    but the worktree group data is in the memoized projectSections from a PREVIOUS render
    //    where availableWorktreesByProject was different.
    //
    // ALTERNATIVELY: The issue could be that there's a render between the worktree
    // being added to availableWorktreesByProject and the projectSections being recomputed.
    // During this window, clicking on the worktree session selects it correctly (setCurrentSession
    // updates currentSessionId), but the layout effect has projectSections from the PREVIOUS render
    // (without worktrees) and falls through to Path C.

    // Phase 1: Sidebar renders WITHOUT worktrees
    const initialSections = buildProjectSections(false);
    const initialMeta = buildProjectSessionMeta(initialSections);

    // Phase 2: availableWorktreesByProject is updated (async git discovery)
    // The sidebar WILL re-render with worktrees on the NEXT render
    // But projectSections is computed during render, so it depends on whether
    // React has already committed the state change

    // Phase 3: Before the re-render with worktrees happens (or during the re-render
    // but with stale useMemo), the user clicks on the worktree session.
    // This is the race condition window.

    // Simulate the state DURING the render that produces worktree data
    const updatedSections = buildProjectSections(true);
    const updatedMeta = buildProjectSessionMeta(updatedSections);

    // Now simulate what happens if the layout effect fires with CURRENT
    // projectSessionMeta (which has worktrees) and the clicked session.
    // This is what SHOULD happen if everything is in sync.
    const correctResult = simulateLayoutEffect(
      PROJECT_A.id,
      WORKTREE_SESSION_1.id,
      updatedSections,
      updatedMeta,
      activeSessionByProject,
    );
    expect(correctResult.action).toBe('persist');

    // But the bug only reproduces when projectSessionMeta is stale.
    // This happens if the effect runs with old projectSections but new
    // activeProjectId and currentSessionId.
    //
    // In React 18+, state updates are batched. But if projectSections is a
    // React.useMemo that depends on availableWorktreesByProject, and
    // availableWorktreesByProject hasn't changed (still the old Map reference),
    // then projectSections/projectSessionMeta are from the memo cache — they
    // DON'T reflect the new worktree data yet.

    // The key insight: the worktree is visible in the sidebar because the
    // component hierarchy renders it, but if the route/state updates caused
    // by the click handler don't trigger a projectSections recomputation,
    // the layout effect has stale session metadata.

    // This misalignment is the root cause:
    const staleSections = buildProjectSections(false); // missing worktree
    const staleMeta = buildProjectSessionMeta(staleSections);

    const staleResult = simulateLayoutEffect(
      PROJECT_A.id,                            // ← new (from setActiveProjectIdOnly)
      WORKTREE_SESSION_1.id,                   // ← new (from setCurrentSession)
      staleSections,                           // ← stale (memoized, no worktree data)
      staleMeta,                               // ← stale (memoized, no worktree data)
      activeSessionByProject,
    );

    // The bug: effect navigates ROOT_SESSION_A instead of preserving WORKTREE_SESSION_1
    expect(staleResult.action).toBe('navigate-to');
    expect(staleResult.targetSessionId).toBe(ROOT_SESSION_A.id);
  });

  // ======== Test 7: Verify handleSessionSelect interaction ========
  test('handleSessionSelect behavior when switching to worktree session', () => {
    // This simulates the full useSessionActions.handleSessionSelect flow
    // and verifies that both setActiveProjectIdOnly and setCurrentSession
    // are called correctly.
    //
    // However, the bug isn't in handleSessionSelect itself — it correctly
    // sets currentSessionId to the clicked session. The bug is that the
    // useLayoutEffect in useProjectSessionSelection then OVERRIDES this
    // with a different session.

    let activeProjectId: string | null = PROJECT_B.id;
    let currentDirectory: string | null = PROJECT_B.normalizedPath;
    let currentSessionId: string | null = ROOT_SESSION_B.id;

    const setActiveProjectIdOnly = (id: string) => {
      activeProjectId = id;
      callSequence.push(`setActiveProjectIdOnly(${id})`);
    };

    const setDirectory = (dir: string) => {
      currentDirectory = dir;
      callSequence.push(`setDirectory(${dir})`);
    };

    const setCurrentSession = (id: string, dirHint?: string | null) => {
      currentSessionId = id;
      callSequence.push(`setCurrentSession(${id}, ${dirHint})`);
    };

    // Simulate clicking on worktree session
    const handleSessionSelect = (
      sessionId: string,
      sessionDirectory?: string | null,
      projectId?: string | null,
    ) => {
      if (projectId && projectId !== activeProjectId) {
        setActiveProjectIdOnly(projectId);
      }
      if (sessionDirectory && sessionDirectory !== currentDirectory) {
        setDirectory(sessionDirectory);
      }
      if (sessionId !== currentSessionId) {
        setCurrentSession(sessionId, sessionDirectory ?? null);
      }
    };

    handleSessionSelect(WORKTREE_SESSION_1.id, WORKTREE_DIR, PROJECT_A.id);

    // Verify handleSessionSelect correctly updated state
    expect(activeProjectId).toBe(PROJECT_A.id);
    expect(currentDirectory).toBe(WORKTREE_DIR);
    expect(currentSessionId).toBe(WORKTREE_SESSION_1.id);

    expect(callSequence).toEqual([
      'setActiveProjectIdOnly(proj-a)',
      `setDirectory(${WORKTREE_DIR})`,
      'setCurrentSession(worktree-session-1, /home/user/my-project-worktree)',
    ]);

    // NOW: the layout effect runs with the NEW activeProjectId and currentSessionId
    // but with STALE projectSessionMeta (computed from a stale projectSections)
  });
});
