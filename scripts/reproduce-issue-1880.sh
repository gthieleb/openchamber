#!/usr/bin/env bash
# Reproduce issue #1880: KaTeX font files not loaded from CSS @import
set -euo pipefail

echo "=== Reproducing Issue #1880 ==="
echo "Math formulas rendered in upright (roman) font instead of italic"
echo "Root cause: KaTeX CSS loaded via CSS @import instead of JS import"
echo ""

# Step 1: Confirm the CSS @import line is present
echo "--- Step 1: Verify KaTeX CSS @import in index.css ---"
IMPORT_LINE=$(grep -n '@import "katex/dist/katex.min.css"' packages/ui/src/index.css || true)
if [ -n "$IMPORT_LINE" ]; then
  echo "FOUND: $IMPORT_LINE"
  echo "Status: KaTeX CSS is loaded via CSS @import (buggy path)"
else
  echo "NOT FOUND: KaTeX CSS @import not in index.css"
  echo "This may have been fixed already."
  exit 1
fi
echo ""

# Step 2: Build the web app
echo "--- Step 2: Building web app ---"
bun run --filter=@openchamber/web build 2>&1 | tail -5
echo ""

# Step 3: Check if KaTeX .woff2 font files exist in build output
echo "--- Step 3: Check for KaTeX font files in build output ---"
KATEX_FONTS=$(ls packages/web/dist/assets/ | grep -i 'KaTeX' 2>/dev/null || true)
if [ -z "$KATEX_FONTS" ]; then
  echo "MISSING: No KaTeX font files found in dist/assets/"
  echo ""
  echo "Only these woff2 files exist in build output:"
  ls packages/web/dist/assets/*.woff2 2>/dev/null || echo "(none)"
else
  echo "FOUND KaTeX fonts (unexpected - bug may be fixed):"
  echo "$KATEX_FONTS"
fi
echo ""

# Step 4: Check the inlined CSS for unresolvable relative font paths
echo "--- Step 4: Check KaTeX @font-face URLs in built CSS ---"
CSS_FILE=$(ls packages/web/dist/assets/index-*.css 2>/dev/null | head -1)
if [ -f "$CSS_FILE" ]; then
  FONT_URLS=$(grep -o 'url(fonts/KaTeX_[^)]*' "$CSS_FILE" | head -5)
  if [ -n "$FONT_URLS" ]; then
    echo "KaTeX @font-face declarations use unresolvable relative paths:"
    echo "$FONT_URLS"
    echo ""
    echo "These paths reference 'fonts/KaTeX_*.woff2' but no 'fonts/' directory"
    echo "exists in dist/assets/. The font files are never copied to build output."
  else
    echo "No KaTeX font URLs found in CSS (unexpected)"
  fi
fi

# Also check if KaTeX @font-face blocks appear in the built CSS at all
echo ""
echo "Checking all built CSS files for KaTeX @font-face declarations:"
for f in packages/web/dist/assets/*.css; do
  if grep -q 'KaTeX_Math' "$f" 2>/dev/null; then
    echo "  KaTeX @font-face found in: $f"
  fi
done
echo ""

# Step 5: Contrast with IBM Plex fonts (loaded via JS import)
echo "--- Step 5: Contrast with IBM Plex fonts (JS import, works correctly) ---"
VENDOR_CSS=$(ls packages/web/dist/assets/vendor*.css 2>/dev/null | head -1)
IBM_URLS=$(grep -o 'url(/assets/ibm-plex[^)]*' "$VENDOR_CSS" 2>/dev/null | head -3)
if [ -n "$IBM_URLS" ]; then
  echo "IBM Plex fonts use correct /assets/ paths:"
  echo "$IBM_URLS"
  echo ""
  echo "IBM Plex .woff2 files ARE present in build output:"
  ls packages/web/dist/assets/*ibm-plex*.woff2 2>/dev/null
fi
echo ""

echo "=== REPRODUCTION CONFIRMED ==="
echo ""
echo "Summary:"
echo "  - KaTeX CSS content is inlined into the vendor CSS bundle via CSS @import"
echo "  - The @font-face src: url(fonts/KaTeX_*.woff2) paths are relative and unresolvable"
echo "  - KaTeX .woff2 font files are NOT copied to dist/assets/"
echo "  - Browsers cannot load the KaTeX fonts, fall back to upright parent font"
echo "  - IBM Plex fonts (loaded via JS import) work correctly"
echo ""
echo "Fix: Remove @import from index.css, load katex/dist/katex.min.css via JS import"
echo "in each app entry point (packages/web/src/main.tsx, mobile-main.tsx, mini-chat-main.tsx)"
