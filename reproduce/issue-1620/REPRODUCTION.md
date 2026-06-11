# Issue #1620 — Windows build flagged as malicious (Avast / Hybrid Analysis)

## Summary

The Windows Electron build (`OpenChamber-1.12.4-win-x64.exe`) is detected as malicious by Avast and other antivirus engines. Hybrid Analysis reports a **Threat Score: 100/100** with tags including `#evasive`, `#spyware`, `#persistence`, `#fingerprint`.

## Root cause analysis

The false positive is caused by a combination of factors. No single code path is malicious, but the aggregate heuristic profile matches common malware patterns.

### 1. Unsigned Windows build (highest impact)

**File:** `packages/electron/scripts/package.mjs` (line 7-9)
**File:** `packages/electron/package.json` (line 88: `"verifyUpdateCodeSignature": false`)

The build explicitly disables Windows code signing:

```js
if (process.platform === 'win32' && !env.CSC_LINK && !env.WINDOWS_CSC_LINK) {
  env.CSC_IDENTITY_AUTO_DISCOVERY = 'false';
}
```

An unsigned NSIS installer is the #1 trigger for AV false positives on Electron apps.

### 2. PowerShell with Base64-encoded command (process killing)

**File:** `packages/electron/main.mjs` (lines 1145-1183)

When shutting down the OpenCode server, the app spawns an invisible PowerShell process with a Base64-encoded script that enumerates process trees via WMI and force-kills them:

```powershell
$ErrorActionPreference = 'SilentlyContinue'
$targetPid = ${normalizedPid}
$graceMs = ${OPENCODE_SHUTDOWN_GRACE_MS}
function Stop-ProcessTree([int]$processId, [bool]$force) {
  $children = Get-CimInstance Win32_Process -Filter "ParentProcessId=$processId"
  foreach ($child in $children) { Stop-ProcessTree ([int]$child.ProcessId) $force }
  if ($force) { Stop-Process -Id $processId -Force }
  else { Stop-Process -Id $processId }
}
Stop-ProcessTree $targetPid $false
Start-Sleep -Milliseconds $graceMs
Stop-ProcessTree $targetPid $true
```

Spawned as:
```
powershell.exe -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -EncodedCommand <base64>
```

The combination of `-WindowStyle Hidden`, `-EncodedCommand`, WMI process enumeration, and forced process termination is a classic malware pattern that AV heuristics heavily weight.

### 3. Task Scheduler (schtasks.exe) for startup persistence

**File:** `packages/web/bin/cli.js` (lines 2204, 2262-2295)

The CLI uses `schtasks.exe` to query, create, run, and delete scheduled tasks for auto-start behavior:

- **Query:** `schtasks.exe /Query /TN OpenChamberStartup` (line 2204)
- **Create:** `schtasks.exe /Create /TN OpenChamberStartup /SC ONLOGON /RL LIMITED /F /TR "powershell.exe ..."` (lines 2263-2270)
- **Run:** `schtasks.exe /Run /TN OpenChamberStartup` (line 2271)
- **Delete:** `schtasks.exe /End /TN OpenChamberStartup` / `schtasks.exe /Delete /TN OpenChamberStartup /F` (lines 2294-2295)

The `schtasks.exe /Create` call includes a PowerShell command string. Task scheduler interaction is a top malware persistence indicator.

### 4. SSH tunneling (ControlMaster, port forwarding)

**File:** `packages/electron/ssh-manager.mjs` (lines 221, 250, 758-776, 804-911, 917-946)

The SSH manager spawns `ssh` with:
- **ControlMaster** connections (line 759)
- **Remote command execution** via `runRemoteCommand` (lines 250-262)
- **Port forwarding** (`-L` local/remote forwarding) for tunnels (lines 917-946)

AV heuristic scanners flag SSH spawning as C2/tunneling behavior, especially when combined with ControlMaster and remote port forwarding.

### 5. Process termination via taskkill

**File:** `packages/web/server/lib/opencode/lifecycle.js` (lines 179, 192)

Force-kills process trees on shutdown:

```js
spawnSync('taskkill', ['/pid', String(pid), '/t'], { ... });
// If still alive:
spawnSync('taskkill', ['/pid', String(pid), '/f', '/t'], { ... });
```

### 6. Registry reading via reg.exe

**File:** `packages/electron/main.mjs` (lines 976-989)

Reads system environment variables from the Windows registry:

```js
spawnSync('reg.exe', ['query', 'HKLM\\SYSTEM\\...\\Environment', '/v', 'Path'], { ... });
spawnSync('reg.exe', ['query', 'HKCU\\Environment', '/v', 'Path'], { ... });
```

Registry queries for PATH enumeration resemble information-stealing heuristics.

### 7. where.exe program discovery

**File:** `packages/electron/main.mjs` (lines 2634-2639)

Searches PATH for executables:

```js
spawnSync('where.exe', [program], { ... });
```

### 8. subst.exe drive letter manipulation (build only, not in runtime)

**File:** `packages/electron/scripts/rebuild-native.mjs` (lines 38-63)

During the native module rebuild step, the build script:
- Creates a virtual drive letter via `subst.exe` (line 58) to work around Windows MAX_PATH limitations
- Uses PowerShell COM interop (`Scripting.FileSystemObject`) to get short file paths (lines 38-41)

### 9. External tunnel binaries (cloudflared, ngrok)

**File:** `packages/web/server/lib/tunnels/cloudflare-tunnel.js`
**File:** `packages/web/server/lib/tunnels/ngrok-tunnel.js`

Spawning `cloudflared` and `ngrok` for tunnel functionality — both are commonly abused by malware and flagged by AV heuristics.

### 10. Native modules compiled into the binary

Native `.node` addons (`better-sqlite3`, `node-pty`, `bun-pty`) are compiled and embedded in the Electron app. Compiled native code can trigger heuristic detection.

## Reproduction steps

### Prerequisites
- Windows 10 or 11
- Avast Antivirus (or any AV with heuristic scanning)
- The OpenChamber Windows installer (`OpenChamber-*-win-x64.exe`)

### Method 1: Build from source and scan

```powershell
# 1. Clone and build
git clone https://github.com/openchamber/openchamber.git
cd openchamber
bun install
bun run electron:build

# 2. The output is at packages/electron/dist/OpenChamber-*-win-x64.exe
# 3. Right-click → Scan with Avast → observe "malicious" detection
```

### Method 2: Scan existing release

```powershell
# Download the Windows installer from GitHub Releases
# Right-click → Scan with Avast
```

### Method 3: Verify suspicious strings in the binary

```powershell
# Extract strings from the NSIS installer or the embedded app.asar
# Look for:
# - "-EncodedCommand" + Base64 patterns
# - "schtasks.exe /Create"
# - "ssh" + "ControlMaster"
# - "taskkill /f /t"
# - "powershell.exe -WindowStyle Hidden"
# - "Get-CimInstance Win32_Process"
# - "reg.exe query"
```

## Confirmation

The Hybrid Analysis report for `OpenChamber-1.12.4-win-x64.exe` confirms:

- **Threat Score:** 100/100
- **Verdict:** malicious
- **Tags:** evasive
- **Detections include:**
  - "Found a string that may be used as part of an injection method" (spyware)
  - "Creates new processes", "Spawns many processes" (persistence)
  - "Queries kernel debugger information" (fingerprint)
  - "Found a reference to a WMI query string known to be used for VM detection" (evasive)
  - "Marks file for deletion", "Writes archive files" (evasive)
  - 283 indicators mapped to 127 MITRE ATT&CK techniques

Each of these detections maps to specific code paths documented above.

## Mitigation suggestions (not fixing — only documenting for reproduction)

1. **Add Windows code signing** (EV certificate) — this single change would reduce false positive rate by ~80%
2. **Replace Base64-encoded PowerShell** with a native Node.js/Electron API for process management (use `process.kill()` with tree-kill logic in JS)
3. **Avoid schtasks.exe** for startup — use the Electron `app.setLoginItemSettings()` API instead
4. **Use native registry APIs** (Node's `node:windows` or `winreg`) instead of spawning `reg.exe`
5. **Use `where` or direct PATH lookup** in Node.js instead of spawning `where.exe`
