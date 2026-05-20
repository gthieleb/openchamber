import type { PluginSource } from "./types";

export type RuntimeCapability =
  | "fs.read"
  | "fs.write"
  | "fs.exec"
  | "git.read"
  | "git.write"
  | "terminal"
  | "notifications"
  | "settings.read"
  | "settings.write"
  | "github"
  | "editor"
  | "vscode"
  | "diagnostics"
  | "push";

export interface RuntimeCapabilityDescriptor {
  capability: RuntimeCapability;
  description: string;
  apis: string[];
  dangerous?: boolean;
}

export const RUNTIME_CAPABILITY_DESCRIPTORS: RuntimeCapabilityDescriptor[] = [
  {
    capability: "fs.read",
    description: "Read files and list directories",
    apis: ["files.listDirectory", "files.readFile", "files.statFile", "files.readFileBinary", "files.search"],
  },
  {
    capability: "fs.write",
    description: "Create, write, rename, and delete files",
    apis: ["files.createDirectory", "files.writeFile", "files.delete", "files.rename", "files.revealPath", "files.downloadFile"],
    dangerous: true,
  },
  {
    capability: "fs.exec",
    description: "Execute shell commands",
    apis: ["files.execCommands"],
    dangerous: true,
  },
  {
    capability: "git.read",
    description: "Read git status, branches, log, and identity",
    apis: [
      "git.checkIsGitRepository", "git.getGitStatus", "git.getGitDiff", "git.getGitFileDiff",
      "git.getGitBranches", "git.listGitStashes", "git.getGitLog", "git.getCommitFiles",
      "git.getCurrentGitIdentity", "git.getGitIdentities", "git.getRemotes",
    ],
  },
  {
    capability: "git.write",
    description: "Modify git state (commit, push, pull, branch, merge, rebase, stash)",
    apis: [
      "git.revertGitFile", "git.deleteGitBranch", "git.deleteRemoteBranch", "git.removeRemote",
      "git.createGitCommit", "git.gitPush", "git.gitPull", "git.gitFetch",
      "git.stashGitChanges", "git.applyGitStash", "git.popGitStash", "git.dropGitStash",
      "git.checkoutBranch", "git.createBranch", "git.renameBranch",
      "git.setGitIdentity", "git.createGitIdentity", "git.updateGitIdentity", "git.deleteGitIdentity",
      "git.rebase", "git.abortRebase", "git.continueRebase",
      "git.merge", "git.abortMerge", "git.continueMerge",
      "git.stash", "git.stashPop",
    ],
    dangerous: true,
  },
  {
    capability: "terminal",
    description: "Create and interact with terminal sessions",
    apis: ["terminal.createSession", "terminal.connect", "terminal.sendInput", "terminal.resize", "terminal.close"],
    dangerous: true,
  },
  {
    capability: "notifications",
    description: "Send desktop notifications",
    apis: ["notifications.notifyAgentCompletion", "notifications.canNotify"],
  },
  {
    capability: "settings.read",
    description: "Read application settings",
    apis: ["settings.load"],
  },
  {
    capability: "settings.write",
    description: "Modify application settings",
    apis: ["settings.save"],
    dangerous: true,
  },
  {
    capability: "github",
    description: "Access GitHub API (PRs, issues, auth)",
    apis: [
      "github.authStatus", "github.authStart", "github.authComplete", "github.authDisconnect",
      "github.prStatus", "github.prCreate", "github.prUpdate", "github.prMerge", "github.prReady",
      "github.prsList", "github.prContext",
      "github.issuesList", "github.issueGet", "github.issueComments",
      "github.repoUpstream", "github.repoBranches",
    ],
  },
  {
    capability: "editor",
    description: "Open files and diffs in the editor",
    apis: ["editor.openFile", "editor.openDiff"],
  },
  {
    capability: "vscode",
    description: "Execute VS Code commands",
    apis: ["vscode.executeCommand", "vscode.openAgentManager", "vscode.openExternalUrl"],
  },
  {
    capability: "diagnostics",
    description: "Access diagnostic logs",
    apis: ["diagnostics.downloadLogs"],
  },
  {
    capability: "push",
    description: "Web push notification subscription",
    apis: ["push.getVapidPublicKey", "push.subscribe", "push.unsubscribe", "push.setVisibility"],
  },
];

export interface PluginRuntimeAPIs {
  files: {
    listDirectory?: (path: string, options?: unknown) => Promise<unknown>;
    search?: (payload: unknown) => Promise<unknown>;
    createDirectory?: (path: string) => Promise<unknown>;
    statFile?: (path: string, options?: unknown) => Promise<unknown>;
    readFile?: (path: string, options?: unknown) => Promise<unknown>;
    readFileBinary?: (path: string, options?: unknown) => Promise<unknown>;
    writeFile?: (path: string, content: string) => Promise<unknown>;
    delete?: (path: string) => Promise<unknown>;
    rename?: (oldPath: string, newPath: string) => Promise<unknown>;
    revealPath?: (path: string) => Promise<unknown>;
    execCommands?: (commands: string[], cwd: string) => Promise<unknown>;
    downloadFile?: (path: string) => Promise<void>;
  };
  git: {
    checkIsGitRepository?: (directory: string) => Promise<boolean>;
    getGitStatus?: (directory: string, options?: unknown) => Promise<unknown>;
    getGitDiff?: (directory: string, options: unknown) => Promise<unknown>;
    getGitFileDiff?: (directory: string, options: unknown) => Promise<unknown>;
    revertGitFile?: (directory: string, filePath: string) => Promise<void>;
    getGitBranches?: (directory: string) => Promise<unknown>;
    deleteGitBranch?: (directory: string, payload: unknown) => Promise<unknown>;
    deleteRemoteBranch?: (directory: string, payload: unknown) => Promise<unknown>;
    removeRemote?: (directory: string, payload: unknown) => Promise<unknown>;
    generateCommitMessage?: (directory: string, files: string[], options?: unknown) => Promise<unknown>;
    generatePullRequestDescription?: (directory: string, payload: unknown) => Promise<unknown>;
    listGitWorktrees?: (directory: string) => Promise<unknown>;
    createGitCommit?: (directory: string, message: string, options?: unknown) => Promise<unknown>;
    gitPush?: (directory: string, options?: unknown) => Promise<unknown>;
    gitPull?: (directory: string, options?: unknown) => Promise<unknown>;
    gitFetch?: (directory: string, options?: unknown) => Promise<unknown>;
    listGitStashes?: (directory: string) => Promise<unknown>;
    stashGitChanges?: (directory: string, options?: unknown) => Promise<unknown>;
    applyGitStash?: (directory: string, options: unknown) => Promise<unknown>;
    popGitStash?: (directory: string, options: unknown) => Promise<unknown>;
    dropGitStash?: (directory: string, options: unknown) => Promise<unknown>;
    checkoutBranch?: (directory: string, branch: string) => Promise<unknown>;
    createBranch?: (directory: string, name: string, startPoint?: string) => Promise<unknown>;
    renameBranch?: (directory: string, oldName: string, newName: string) => Promise<unknown>;
    getGitLog?: (directory: string, options?: unknown) => Promise<unknown>;
    getCommitFiles?: (directory: string, hash: string) => Promise<unknown>;
    getCurrentGitIdentity?: (directory: string) => Promise<unknown>;
    setGitIdentity?: (directory: string, profileId: string) => Promise<unknown>;
    getGitIdentities?: () => Promise<unknown>;
    createGitIdentity?: (profile: unknown) => Promise<unknown>;
    updateGitIdentity?: (id: string, updates: unknown) => Promise<unknown>;
    deleteGitIdentity?: (id: string) => Promise<void>;
    getRemotes?: (directory: string) => Promise<unknown>;
    rebase?: (directory: string, options: unknown) => Promise<unknown>;
    abortRebase?: (directory: string) => Promise<unknown>;
    continueRebase?: (directory: string) => Promise<unknown>;
    merge?: (directory: string, options: unknown) => Promise<unknown>;
    abortMerge?: (directory: string) => Promise<unknown>;
    continueMerge?: (directory: string) => Promise<unknown>;
    stash?: (directory: string, options?: unknown) => Promise<unknown>;
    stashPop?: (directory: string) => Promise<unknown>;
  };
  terminal: {
    createSession?: (options: unknown) => Promise<unknown>;
    connect?: (sessionId: string, handlers: unknown, options?: unknown) => unknown;
    sendInput?: (sessionId: string, input: string) => Promise<void>;
    resize?: (payload: unknown) => Promise<void>;
    close?: (sessionId: string) => Promise<void>;
  };
  settings: {
    load?: () => Promise<unknown>;
    save?: (changes: unknown) => Promise<unknown>;
  };
  notifications: {
    notifyAgentCompletion?: (payload?: unknown) => Promise<boolean>;
    canNotify?: () => boolean | Promise<boolean>;
  };
  github?: {
    authStatus?: () => Promise<unknown>;
    authStart?: () => Promise<unknown>;
    authComplete?: (deviceCode: string) => Promise<unknown>;
    authDisconnect?: () => Promise<unknown>;
    prStatus?: (directory: string, branch: string, remote?: string, options?: unknown) => Promise<unknown>;
    prCreate?: (payload: unknown) => Promise<unknown>;
    prUpdate?: (payload: unknown) => Promise<unknown>;
    prMerge?: (payload: unknown) => Promise<unknown>;
    prReady?: (payload: unknown) => Promise<unknown>;
    prsList?: (directory: string, options?: unknown) => Promise<unknown>;
    prContext?: (directory: string, number: number, options?: unknown) => Promise<unknown>;
    issuesList?: (directory: string, options?: unknown) => Promise<unknown>;
    issueGet?: (directory: string, number: number, options?: unknown) => Promise<unknown>;
    issueComments?: (directory: string, number: number, options?: unknown) => Promise<unknown>;
    repoUpstream?: (directory: string) => Promise<unknown>;
    repoBranches?: (owner: string, repo: string) => Promise<string[]>;
  };
  editor?: {
    openFile?: (path: string, line?: number, column?: number) => Promise<void>;
    openDiff?: (original: string, modified: string, label?: string, options?: unknown) => Promise<void>;
  };
  vscode?: {
    executeCommand?: (command: string, ...args: unknown[]) => Promise<unknown>;
    openAgentManager?: () => Promise<void>;
    openExternalUrl?: (url: string) => Promise<void>;
  };
  diagnostics?: {
    downloadLogs?: () => Promise<unknown>;
  };
  push?: {
    getVapidPublicKey?: () => Promise<unknown>;
    subscribe?: (payload: unknown) => Promise<unknown>;
    unsubscribe?: (payload: unknown) => Promise<unknown>;
    setVisibility?: (payload: unknown) => Promise<unknown>;
  };
}

export interface PluginRuntimeAPIConfig {
  grantedCapabilities: RuntimeCapability[];
  deniedCapabilities: RuntimeCapability[];
  source: PluginSource;
  pluginId: string;
}

export function hasCapability(config: PluginRuntimeAPIConfig, capability: RuntimeCapability): boolean {
  return config.grantedCapabilities.includes(capability) && !config.deniedCapabilities.includes(capability);
}
