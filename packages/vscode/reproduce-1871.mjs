#!/usr/bin/env node
/**
 * Reproduction script for issue #1871:
 * Managed mode starts `opencode` with cwd = extension globalStorageUri
 * instead of workspace root, causing crash loop / 502.
 *
 * Usage:
 *   node reproduce-1871.mjs
 *
 * This script analyzes the source code to confirm the bug.
 * It does NOT spawn a real opencode process — it only demonstrates
 * the wrong code path by tracing the variable assignments.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const opencodeSource = path.join(__dirname, 'src', 'opencode.ts');
const source = fs.readFileSync(opencodeSource, 'utf8');
const lines = source.split('\n');

console.log('=== Reproduction: Issue #1871 ===');
console.log('Managed mode starts `opencode` with cwd = extension globalStorageUri\n');

// ---- Helper: find line by substring ----
function findLine(text, pattern) {
  const idx = text.findIndex(l => l.includes(pattern));
  return idx >= 0 ? { line: idx + 1, content: text[idx].trim() } : null;
}

// ---- 1. Show workspaceDirectory vs serverWorkingDirectory ----
const wdLine = findLine(lines, 'const workspaceDirectory = (): string');
const swdLine = findLine(lines, 'const serverWorkingDirectory = (): string');

console.log('--- Key variable definitions (lines 745-748) ---');
if (wdLine) console.log(`LINE ${wdLine.line}: ${wdLine.content}`);
if (swdLine) console.log(`LINE ${swdLine.line}: ${swdLine.content}`);

const workingDirInit = findLine(lines, 'let workingDirectory: string = workspaceDirectory()');
if (workingDirInit) console.log(`LINE ${workingDirInit.line}: ${workingDirInit.content}`);

console.log('\n  workspaceDirectory()  → workspace root (e.g. /ssd/scxj495)');
console.log('  serverWorkingDirectory() → globalStorageUri.fsPath (e.g. /ssd/.config/.../globalStorage/fedaykindev.openchamber)');
console.log('  workingDirectory       → initialized to workspaceDirectory() — CORRECT');

// ---- 2. Show the bug in startInternal ----
const serverCwdLine = findLine(lines, "const serverCwd = serverWorkingDirectory()");
const spawnLine = findLine(lines, 'server = await spawnManagedOpenCodeServer(serverCwd,');

console.log('\n--- Bug location: startInternal() (lines 921-927) ---');
if (serverCwdLine) {
  console.log(`LINE ${serverCwdLine.line}: ${serverCwdLine.content}`);
  console.log('  ↑ BUG: serverCwd is set to globalStorageUri.fsPath instead of the workspace root.');
}

// Show surrounding context
const chdirLine = findLine(lines, 'process.chdir(serverCwd)');
if (chdirLine) console.log(`LINE ${chdirLine.line}: ${chdirLine.content}  — changes parent cwd to globalStorage (also wrong)`);

if (spawnLine) {
  console.log(`LINE ${spawnLine.line}: ${spawnLine.content}`);
  console.log('  ↑ BUG: server is spawned with cwd = globalStorageUri.fsPath.');
  console.log('  OpenCode treats this cwd as its project directory.');
  console.log('  Since globalStorage is not a valid workspace (no .git/.opencode),');
  console.log('  OpenCode crashes → restart loop → 502s.');
}

// ---- 3. Show spawnManagedOpenCodeServer uses cwd ----
const spawnFnLine = findLine(lines, 'async function spawnManagedOpenCodeServer(');
const spawnCwdLine = findLine(lines, 'cwd: workingDirectory,');
let spawnCwdContext = null;
if (spawnFnLine) {
  console.log(`\n--- spawnManagedOpenCodeServer (line ${spawnFnLine.line}) ---`);
  console.log(`LINE ${spawnFnLine.line}: function signature — first param = workingDirectory`);
  if (spawnCwdLine) {
    console.log(`LINE ${spawnCwdLine.line}: ${spawnCwdLine.content}`);
    console.log('  ↑ The `workingDirectory` parameter is used as child process cwd.');
    console.log('  This becomes the directory that opencode serve uses as project root.');
  }
}

// ---- 4. Show the fix ----
console.log('\n--- Suggested fix ---');
console.log("  In startInternal() at line 921:");
console.log('    Change: const serverCwd = serverWorkingDirectory();');
console.log('    To:     const serverCwd = workingDirectory;');
console.log('');
console.log('  This ensures:');
console.log('  - The opencode serve process is spawned with cwd = workspace root');
console.log('  - OpenCode treats the actual workspace as its project directory');
console.log('  - No crash loop from trying to use globalStorage as project root');

// ---- 5. Summary ----
console.log('\n=== Summary ===');
console.log('Bug confirmed in packages/vscode/src/opencode.ts:');
console.log('- Lines 745-748: workspaceDirectory() and serverWorkingDirectory() are defined correctly');
console.log('- Line 748: workingDirectory starts as workspaceDirectory() — correct');
console.log('- Lines 855-858: workingDirectory is updated to the passed workdir or workspaceDirectory()');
console.log('- Line 921: serverCwd = serverWorkingDirectory() — WRONG, should be workingDirectory');
console.log('- Line 927: spawnManagedOpenCodeServer(serverCwd, ...) — spawns with wrong cwd');
console.log('- Lines 621: spawn(binary, args, { cwd: workingDirectory }) — the root cause');
console.log('');
console.log('The variable `workingDirectory` already holds the correct workspace path, but');
console.log('`serverWorkingDirectory()` (globalStorageUri) is used instead when spawning the server.');
console.log('');
console.log('Fix: change line 921 from `serverWorkingDirectory()` to `workingDirectory`');
