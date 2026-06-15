/**
 * Reproduction script for issue #1670: Session count not shown in Desktop sidebar
 *
 * This script verifies that the mobile sessions sheet shows session count badges
 * on project headers and worktree group headers, while the desktop sidebar does not.
 */

const fs = require('fs');
const path = require('path');

const UI_SRC = path.join(__dirname, 'packages/ui/src');
const SIDEBAR_SRC = path.join(UI_SRC, 'components/session/sidebar');
const APPS_SRC = path.join(UI_SRC, 'apps');

function checkFileContains(filePath, pattern, label) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const found = pattern.test(content);
  console.log(`${found ? '✓' : '✗'} ${label}: ${found ? 'Found' : 'NOT found'} in ${path.basename(filePath)}`);
  return found;
}

console.log('=== Issue #1670 Reproduction: Session count in Desktop vs Mobile ===\n');

// Mobile: check that count IS displayed on project headers
const mobileSheetFile = path.join(APPS_SRC, 'MobileSessionsSheet.tsx');
console.log('--- Mobile view (MobileSessionsSheet.tsx) ---');
const mobileProjectCount = checkFileContains(
  mobileSheetFile,
  /\{node\.totalSessions\}/,
  'Project header session count badge'
);
const mobileWorktreeCount = checkFileContains(
  mobileSheetFile,
  /\{bucket\.sessions\.length\}/,
  'Worktree group header session count badge'
);

// Desktop: check SortableProjectItem for session count prop/display
const sortableItemsFile = path.join(SIDEBAR_SRC, 'sortableItems.tsx');
console.log('\n--- Desktop view (SortableProjectItem) ---');
const desktopProjectHasCountProp = checkFileContains(
  sortableItemsFile,
  /totalSessions/,
  'SortableProjectItem has totalSessions prop'
);
const desktopProjectHasCountDisplay = checkFileContains(
  sortableItemsFile,
  /totalSessions|sessionCount/,
  'SortableProjectItem displays session count'
);

// Desktop: check SessionGroupSection for session count display
const groupSectionFile = path.join(SIDEBAR_SRC, 'SessionGroupSection.tsx');
console.log('\n--- Desktop view (SessionGroupSection) ---');
const desktopGroupComputesCount = checkFileContains(
  groupSectionFile,
  /^  const totalSessions = ungroupedSessions\.length;/m,
  'SessionGroupSection computes totalSessions'
);
const desktopGroupDisplaysCount = checkFileContains(
  groupSectionFile,
  /\{totalSessions\}/,
  'SessionGroupSection displays totalSessions count'
);

// Check what totalSessions is used for
const groupContent = fs.readFileSync(groupSectionFile, 'utf-8');
const totalSessionsUses = [];
const lines = groupContent.split('\n');
lines.forEach((line, i) => {
  if (line.includes('totalSessions')) {
    totalSessionsUses.push(`Line ${i + 1}: ${line.trim()}`);
  }
});
console.log('\ntotalSessions usage in SessionGroupSection.tsx:');
totalSessionsUses.forEach(u => console.log(`  ${u}`));

console.log('\n=== RESULT ===');
if (mobileProjectCount && mobileWorktreeCount && !desktopProjectHasCountDisplay && !desktopGroupDisplaysCount) {
  console.log('BUG CONFIRMED: Desktop sidebar does NOT show session count badges,');
  console.log('while the mobile view does (on both project headers and worktree groups).');
} else if (desktopProjectHasCountDisplay) {
  console.log('Desktop project header already shows count (bug may be fixed).');
} else if (desktopGroupDisplaysCount) {
  console.log('Desktop group header already shows count (bug may be fixed).');
} else {
  console.log('Some checks inconsistent - manual review needed.');
}
