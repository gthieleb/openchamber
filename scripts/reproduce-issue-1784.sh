#!/usr/bin/env bash
# Reproduction attempt for issue #1784
# "autoPip.js: 'enterpictureinpicture' is not a valid MediaSessionAction enum"
set -euo pipefail

echo "=== Issue #1784 Reproduction ==="
echo ""

# 1. Search for any file named autoPip.*
echo "--- 1. Searching for autoPip files ---"
AUTOPIP_FILES=$(find . -name "autoPip*" -not -path "./.git/*" -not -path "./node_modules/.bun/terser*" 2>/dev/null)
if [ -z "$AUTOPIP_FILES" ]; then
  echo "  No autoPip files found anywhere in the repository."
else
  echo "  Found: $AUTOPIP_FILES"
fi
echo ""

# 2. Search for 'enterpictureinpicture' in source code
echo "--- 2. Searching for 'enterpictureinpicture' in source ---"
ENTER_COUNT=$(grep -rn "enterpictureinpicture" packages/ 2>/dev/null | wc -l)
if [ "$ENTER_COUNT" -eq 0 ]; then
  echo "  No occurrences of 'enterpictureinpicture' in source files."
else
  echo "  Found $ENTER_COUNT occurrences"
fi
echo ""

# 3. Search for 'togglepictureinpicture' in source code
echo "--- 3. Searching for 'togglepictureinpicture' in source ---"
TOGGLE_COUNT=$(grep -rn "togglepictureinpicture" packages/ 2>/dev/null | wc -l)
if [ "$TOGGLE_COUNT" -eq 0 ]; then
  echo "  No occurrences of 'togglepictureinpicture' in source files."
else
  echo "  Found $TOGGLE_COUNT occurrences"
fi
echo ""

# 4. Search for 'MediaSession.setActionHandler' in source
echo "--- 4. Searching for MediaSession API usage ---"
MEDIA_COUNT=$(grep -rn "MediaSession\|setActionHandler" packages/ --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" 2>/dev/null | wc -l)
if [ "$MEDIA_COUNT" -eq 0 ]; then
  echo "  No MediaSession or setActionHandler references in source files."
else
  echo "  Found $MEDIA_COUNT occurrences"
fi
echo ""

# 5. Check dist output for autoPip files
echo "--- 5. Checking build output ---"
if [ -d "packages/web/dist" ]; then
  DIST_AUTOPIP=$(find packages/web/dist -name "*autoPip*" 2>/dev/null)
  DIST_PIP=$(find packages/web/dist -name "*pip*" ! -name "*pipeline*" ! -name "*minipass*" 2>/dev/null)
  if [ -z "$DIST_AUTOPIP" ] && [ -z "$DIST_PIP" ]; then
    echo "  No autoPip or pip-related files in dist/."
  else
    echo "  Found: ${DIST_AUTOPIP} ${DIST_PIP}"
  fi
else
  echo "  No dist/ directory (build not run)."
fi
echo ""

# 6. Check dependencies for MediaSession usage
echo "--- 6. Checking node_modules for relevant code ---"
NM_COUNT=$(grep -rn "enterpictureinpicture\|togglepictureinpicture" node_modules/ 2>/dev/null | grep -v "terser\|domprops\|typescript" | wc -l)
if [ "$NM_COUNT" -eq 0 ]; then
  echo "  No 'enterpictureinpicture' or 'togglepictureinpicture' in dependencies."
else
  echo "  Found $NM_COUNT occurrences in node_modules"
fi
echo ""

echo "=== Result: Cannot reproduce ==="
echo "The code described in the issue (autoPip.js calling"
echo "MediaSession.setActionHandler('enterpictureinpicture', ...))"
echo "does not exist in the current state of the repository."
echo ""
echo "No source file, dependency, or build artifact references"
echo "'autoPip', 'enterpictureinpicture', 'togglepictureinpicture',"
echo "or 'MediaSession.setActionHandler'."
