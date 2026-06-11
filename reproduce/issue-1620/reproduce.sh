#!/usr/bin/env bash
# Reproduction script for Issue #1620 — AV false positive detection
# This script identifies all the code patterns that trigger antivirus heuristics.
# Run it on the source to see the evidence.
#
# Usage: bash reproduce/issue-1620/reproduce.sh

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "=== Issue #1620 — Reproducing AV false positive triggers ==="
echo ""

TOTAL=0

check() {
  local label="$1"
  local file="$2"
  local pattern="$3"
  local link="$4"
  TOTAL=$((TOTAL + 1))
  if [ -f "$ROOT_DIR/$file" ]; then
    if grep -q "$pattern" "$ROOT_DIR/$file" 2>/dev/null; then
      echo "  [FOUND]  $label"
      echo "           File: $file"
      echo "           Match: $(grep -c "$pattern" "$ROOT_DIR/$file") occurrence(s)"
      echo "           Details: $link"
      echo ""
    else
      echo "  [MISS]   $label (pattern not found — may have been fixed)"
      echo ""
    fi
  else
    echo "  [SKIP]   $label (file not found: $file)"
    echo ""
  fi
}

echo "--- 1. Unsigned Windows build ---"
check "No code signing on Windows build" \
  "packages/electron/scripts/package.mjs" \
  "CSC_IDENTITY_AUTO_DISCOVERY.*false" \
  "packages/electron/scripts/package.mjs:7-10"

check "verifyUpdateCodeSignature disabled" \
  "packages/electron/package.json" \
  "verifyUpdateCodeSignature" \
  "packages/electron/package.json:88"

echo "--- 2. PowerShell Base64-encoded commands (process killing) ---"
check "Base64 encoded PowerShell script" \
  "packages/electron/main.mjs" \
  "EncodedCommand" \
  "packages/electron/main.mjs:1145-1183"

check "PowerShell WindowStyle Hidden" \
  "packages/electron/main.mjs" \
  "WindowStyle" \
  "packages/electron/main.mjs:1173-1174"

check "Get-CimInstance Win32_Process" \
  "packages/electron/main.mjs" \
  "Get-CimInstance Win32_Process" \
  "packages/electron/main.mjs:1151"

check "Stop-Process with Force" \
  "packages/electron/main.mjs" \
  "Stop-Process" \
  "packages/electron/main.mjs:1156"

echo "--- 3. Task Scheduler (schtasks.exe) for startup ---"
check "schtasks.exe /Query" \
  "packages/web/bin/cli.js" \
  "schtasks" \
  "packages/web/bin/cli.js:2204"

check "schtasks.exe /Create" \
  "packages/web/bin/cli.js" \
  "schtasks.exe" \
  "packages/web/bin/cli.js:2263-2270"

check "schtasks.exe /Run" \
  "packages/web/bin/cli.js" \
  "schtasks.exe.*Run" \
  "packages/web/bin/cli.js:2271"

check "schtasks.exe /Delete" \
  "packages/web/bin/cli.js" \
  "schtasks.exe.*Delete" \
  "packages/web/bin/cli.js:2294-2295"

echo "--- 4. SSH Tunneling ---"
check "SSH ControlMaster spawn" \
  "packages/electron/ssh-manager.mjs" \
  "ControlMaster" \
  "packages/electron/ssh-manager.mjs:759-776"

check "SSH port forwarding (-L)" \
  "packages/electron/ssh-manager.mjs" \
  "spawnMainForward" \
  "packages/electron/ssh-manager.mjs:917-927"

check "SSH remote command execution" \
  "packages/electron/ssh-manager.mjs" \
  "runRemoteCommand" \
  "packages/electron/ssh-manager.mjs:250-262,804-911"

echo "--- 5. Process termination (taskkill) ---"
check "taskkill /t (process tree)" \
  "packages/web/server/lib/opencode/lifecycle.js" \
  "taskkill.*\/pid.*\/t" \
  "packages/web/server/lib/opencode/lifecycle.js:179"

check "taskkill /f /t (forced)" \
  "packages/web/server/lib/opencode/lifecycle.js" \
  "taskkill.*\/pid.*\/f.*\/t" \
  "packages/web/server/lib/opencode/lifecycle.js:192"

echo "--- 6. Registry reading (reg.exe) ---"
check "reg.exe query (Windows Registry)" \
  "packages/electron/main.mjs" \
  "reg.exe" \
  "packages/electron/main.mjs:977"

echo "--- 7. Program discovery (where.exe) ---"
check "where.exe enumeration" \
  "packages/electron/main.mjs" \
  "where.exe" \
  "packages/electron/main.mjs:2635"

echo "--- 8. Build: subst.exe drive manipulation ---"
check "subst.exe virtual drive" \
  "packages/electron/scripts/rebuild-native.mjs" \
  "subst.exe" \
  "packages/electron/scripts/rebuild-native.mjs:58-63"

check "PowerShell COM interop for ShortPath" \
  "packages/electron/scripts/rebuild-native.mjs" \
  "Scripting.FileSystemObject" \
  "packages/electron/scripts/rebuild-native.mjs:38-41"

echo "--- 9. External tunnel binaries ---"
check "cloudflared tunnel spawn" \
  "packages/web/server/lib/cloudflare-tunnel.js" \
  "spawnCloudflared" \
  "packages/web/server/lib/cloudflare-tunnel.js:71,368,474,564"

check "ngrok tunnel spawn" \
  "packages/web/server/lib/ngrok-tunnel.js" \
  "spawnNgrok" \
  "packages/web/server/lib/ngrok-tunnel.js:91,260"

echo ""
echo "=== Results: $TOTAL checks performed ==="
echo ""
echo "These code patterns collectively trigger AV heuristic detection."
echo "See REPRODUCTION.md for detailed analysis."
