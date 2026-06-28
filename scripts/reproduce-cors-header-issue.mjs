#!/usr/bin/env node
/**
 * Reproduction script for issue #1879:
 * CORS preflight blocks all file-system API calls because the
 * `Access-Control-Allow-Headers` response header is missing
 * `x-opencode-directory` and `x-opencode-directory-encoding`.
 *
 * This script starts a minimal Express server replicating the CORS
 * configuration from packages/web/server/index.js, then sends a
 * preflight OPTIONS request with the actual headers the browser
 * sends. It verifies the preflight is rejected.
 */

import http from 'node:http';
import { once } from 'node:events';

// A minimal replication of the CORS config from index.js lines 1110-1125
const CURRENT_ACAH =
  'Content-Type,Authorization,Accept,X-Requested-With,Cache-Control,X-OpenCode-Directory';

const FIXED_ACAH =
  'Content-Type,Authorization,Accept,X-Requested-With,Cache-Control,'
  + 'x-opencode-directory,x-opencode-directory-encoding';

function createServer(allowHeaders) {
  return http.createServer((req, res) => {
    // Simulate the CORS middleware (line 1110-1125)
    const origin = req.headers.origin || '';
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', allowHeaders);
      res.setHeader('Access-Control-Expose-Headers', 'x-next-cursor');
      res.setHeader('Vary', 'Origin');
      if (req.method === 'OPTIONS') {
        res.statusCode = 204;
        res.end();
        return;
      }
    }
    // For non-OPTIONS, just respond
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true }));
  });
}

async function testPreflight(server, label, allowHeaders) {
  return new Promise((resolve, reject) => {
    server.listen(0, async () => {
      const port = server.address().port;
      try {
        // Simulate the browser preflight with the actual headers the UI sends
        const res = await fetch(`http://127.0.0.1:${port}/api/fs/list`, {
          method: 'OPTIONS',
          headers: {
            Origin: 'openchamber-ui://app',
            'Access-Control-Request-Method': 'GET',
            'Access-Control-Request-Headers':
              'x-opencode-directory,x-opencode-directory-encoding',
          },
        });

        const acah = res.headers.get('access-control-allow-headers') || '';
        const hasDirectory = acah.toLowerCase().includes('x-opencode-directory');
        const hasEncoding = acah.toLowerCase().includes('x-opencode-directory-encoding');

        if (hasDirectory && hasEncoding) {
          console.log(`✅ ${label}: PREFLIGHT PASSES (both headers allowed)`);
          resolve(true);
        } else {
          const missing = [];
          if (!hasDirectory) missing.push('x-opencode-directory');
          if (!hasEncoding) missing.push('x-opencode-directory-encoding');
          console.log(`❌ ${label}: PREFLIGHT FAILS — missing: ${missing.join(', ')}`);
          console.log(`   Access-Control-Allow-Headers: ${acah}`);
          resolve(false);
        }
      } catch (err) {
        console.log(`❌ ${label}: ERROR — ${err.message}`);
        resolve(false);
      } finally {
        server.close();
      }
    });
  });
}

async function main() {
  console.log('=== Reproduction: CORS preflight blocks file-system API calls ===\n');

  // Test 1: Current broken configuration
  const server1 = createServer(CURRENT_ACAH);
  const currentResult = await testPreflight(
    server1,
    'Current config (broken)',
    CURRENT_ACAH,
  );

  console.log();

  // Test 2: Fixed configuration
  const server2 = createServer(FIXED_ACAH);
  const fixedResult = await testPreflight(
    server2,
    'Fixed config (working)',
    FIXED_ACAH,
  );

  console.log();
  if (!currentResult && fixedResult) {
    console.log('✓ BUG CONFIRMED: Missing headers in Access-Control-Allow-Headers cause CORS failure.');
    console.log('  The current allowlist has "X-OpenCode-Directory" which does NOT match');
    console.log('  the lowercase "x-opencode-directory" header the client actually sends,');
    console.log('  and "x-opencode-directory-encoding" is entirely absent.');
    process.exit(1); // non-zero = bug reproduced
  } else {
    console.log('Unexpected — bug may already be fixed.');
    process.exit(0);
  }
}

main();
