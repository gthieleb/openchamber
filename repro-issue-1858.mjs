#!/usr/bin/env node
/**
 * Reproduction script for issue #1858
 *
 * Bug: spinner and progress are not imported from @clack/prompts in
 * packages/web/bin/cli-output.js (lines 9-20), but createSpinner()
 * and createProgress() call spinner() (line 91) and progress() (line 95)
 * respectively, causing a ReferenceError at runtime.
 *
 * Reproduction steps:
 *   1. Import the module with isTTY=true so canPrompt() returns true
 *   2. Call createSpinner({}) or createProgress({}) with human output
 *   3. Observe ReferenceError: spinner is not defined / progress is not defined
 */

// Confirm spinner and progress ARE available from @clack/prompts
import { spinner, progress } from '@clack/prompts';
console.log('spinner exported as:', typeof spinner, '(expected: function)');
console.log('progress exported as:', typeof progress, '(expected: function)');

// Use dynamic import so we can set TTY before module init
process.stdout.isTTY = true;
process.stdin.isTTY = true;

const cliOutput = await import(
  '/home/runner/work/openchamber/openchamber/packages/web/bin/cli-output.js'
);

console.log('\n--- Testing createSpinner ---');
try {
  const s = cliOutput.createSpinner({});
  console.log('createSpinner() returned:', s);
  console.log('BUG: No ReferenceError — unexpected. Bug may be fixed?');
  process.exit(1);
} catch (e) {
  console.error('ERROR:', e.constructor.name, '–', e.message);
  if (e instanceof ReferenceError && e.message.includes('spinner')) {
    console.log('✓ BUG CONFIRMED: spinner is not defined (ReferenceError)');
  } else {
    console.log('✗ Different error:', e.message, e.stack);
  }
}

console.log('\n--- Testing createProgress ---');
try {
  const p = await cliOutput.createProgress({});
  console.log('createProgress() returned:', p);
  console.log('BUG: No ReferenceError — unexpected. Bug may be fixed?');
  process.exit(1);
} catch (e) {
  console.error('ERROR:', e.constructor.name, '–', e.message);
  if (e instanceof ReferenceError && e.message.includes('progress')) {
    console.log('✓ BUG CONFIRMED: progress is not defined (ReferenceError)');
  } else {
    console.log('✗ Different error:', e.message, e.stack);
  }
}
