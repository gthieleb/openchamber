#!/usr/bin/env node
/**
 * Reproduction for issue #1767: [Bug] Unable to connect to OpenCode
 * https://github.com/openchamber/openchamber/issues/1767
 *
 * Reproduces the proxy setup used by OpenChamber to identify why
 * the http-proxy-middleware proxy to OpenCode fails with ECONNRESET
 * when running from the npm package, while the Electron installer works.
 *
 * Key findings:
 *   - buildOpenCodeUrl() uses "localhost" but OpenCode binds to "127.0.0.1"
 *   - NO_PROXY env var is set in Electron (main.mjs:1171-1172) but NOT in web/npm CLI
 *   - SSE forwarding uses fetch() (undici) while the API proxy uses http.request() (http-proxy)
 *   - The proxy strips Content-Length and Transfer-Encoding from upstream responses
 */

import { createServer } from 'node:http';
import { request as httpRequest } from 'node:http';
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { lookup } from 'node:dns/promises';

const LISTEN_HOST = '127.0.0.1';
const PROXY_HOST = 'localhost';

console.log('='.repeat(72));
console.log('Issue #1767 Reproduction: OpenCode proxy ECONNRESET');
console.log('='.repeat(72));

// ── 1. DNS Resolution Check ──
console.log('\n[1/5] DNS resolution of localhost vs 127.0.0.1');
try {
  const addrs = await lookup('localhost', { all: true });
  const v4 = addrs.find(a => a.family === 4);
  const v6 = addrs.find(a => a.family === 6);
  console.log(`  localhost resolves to: ${addrs.map(a => `${a.address} (IPv${a.family})`).join(', ')}`);
  if (v6) {
    console.log('  ⚠️  IPv6 address found — on Windows, Node http.request() may connect to');
    console.log('      ::1 first while OpenCode only listens on 127.0.0.1 (IPv4).');
    console.log('      This causes ECONNRESET in the proxy but not in fetch() (undici)');
    console.log('      because the two stacks handle dual-stack resolution differently.');
  }
} catch (err) {
  console.log(`  DNS lookup error: ${err.message}`);
}

// ── 2. Environment Variables ──
console.log('\n[2/5] Environment: NO_PROXY / proxy env vars');
console.log(`  NO_PROXY:          ${process.env.NO_PROXY || '(not set — Electron sets this)'}`);
console.log(`  HTTP_PROXY:        ${process.env.HTTP_PROXY || '(not set)'}`);
console.log(`  HTTPS_PROXY:       ${process.env.HTTPS_PROXY || '(not set)'}`);

if (!process.env.NO_PROXY && !process.env.no_proxy) {
  console.log('  ⚠️  NO_PROXY is not set. This matches the npm/web CLI scenario.');
  console.log('      Electron sets NO_PROXY=localhost,127.0.0.1 before importing the server.');
  console.log('      If HTTP_PROXY is set, undici (fetch) routes localhost through the proxy.');
}

// ── 3. Start mock OpenCode upstream ──
console.log('\n[3/5] Starting mock OpenCode upstream (binds to 127.0.0.1 only)');
const upstreamApp = express();
upstreamApp.get('/global/health', (_req, res) => res.json({ healthy: true }));
upstreamApp.get('/config/providers', (_req, res) => res.json({ ok: true }));
upstreamApp.get('/session', (_req, res) => res.json([]));
upstreamApp.post('/session/:id/prompt_async', express.json(), (req, res) =>
  res.json({ ok: true, messageID: req.body?.messageID })
);

const upstreamServer = await new Promise((resolve, reject) => {
  const s = createServer(upstreamApp);
  s.listen(0, LISTEN_HOST, () => resolve(s));
  s.on('error', reject);
});
const upstreamPort = upstreamServer.address().port;
console.log(`  ✓ Upstream listening on ${LISTEN_HOST}:${upstreamPort}`);
console.log(`    (OpenCode is launched with --hostname 127.0.0.1)`);

// ── 4. Start proxy (like registerOpenCodeProxy) ──
console.log('\n[4/5] Starting proxy (mirrors registerOpenCodeProxy setup)');
const app = express();

// Readiness gate (simplified)
app.use('/api', (_req, _res, next) => next());

// SSE forwarder (uses fetch() directly, like forwardSseRequest)
app.get('/api/global/event', async (_req, res) => {
  try {
    // forwardSseRequest uses fetch() to the upstream
    await fetch(`http://${PROXY_HOST}:${upstreamPort}/global/event`, {
      headers: { Accept: 'text/event-stream' },
    });
    res.status(200).setHeader('content-type', 'text/event-stream').end(':ok\n\n');
  } catch (err) {
    console.error('  ❌ SSE forwarder error:', err.message);
    res.status(503).end();
  }
});

// Session list (uses fetch() directly, like fetchSessionListPayload)
app.get('/api/session', async (_req, res) => {
  try {
    const upstream = await fetch(`http://${PROXY_HOST}:${upstreamPort}/session`);
    res.json(await upstream.json());
  } catch (err) {
    console.error('  ❌ Session list error:', err.message);
    res.status(503).json({ error: 'unavailable' });
  }
});

// Generic proxy (uses http-proxy-middleware — THE PATH THAT FAILS)
const apiProxy = createProxyMiddleware({
  target: `http://${PROXY_HOST}:${upstreamPort}`,
  changeOrigin: true,
  pathRewrite: { '^/api': '' },
  router: () => `http://${PROXY_HOST}:${upstreamPort}`,
  on: {
    proxyReq: (proxyReq) => {
      proxyReq.setHeader('accept-encoding', 'identity');
    },
    error: (err, _req, res) => {
      console.error(`  ❌ [proxy] OpenCode proxy error: ${err.message} (code: ${err.code})`);
      if (res && !res.headersSent) {
        res.status(503).json({ error: 'OpenCode service unavailable' });
      }
    },
  },
});
app.use('/api', apiProxy);

const proxyServer = await new Promise((resolve, reject) => {
  const s = createServer(app);
  s.listen(0, '127.0.0.1', () => resolve(s));
  s.on('error', reject);
});
const proxyPort = proxyServer.address().port;
console.log(`  ✓ Proxy listening on 127.0.0.1:${proxyPort}`);
console.log(`  ✓ Proxy target: http://${PROXY_HOST}:${upstreamPort}`);

// ── 5. Run Tests ──
console.log('\n[5/5] Running connectivity tests');

let passed = 0;
let failed = 0;
const check = (label, okFn) => {
  try { return okFn() ? (passed++, true) : (failed++, false); }
  catch { return (failed++, false); }
};

// 5a: Health check via 127.0.0.1 (like waitForReady uses the URL from OpenCode stdout)
try {
  const res = await fetch(`http://127.0.0.1:${upstreamPort}/global/health`);
  const body = await res.json();
  console.log(`  ✓ Health check via 127.0.0.1 (waitForReady): ${body.healthy ? 'healthy' : 'unhealthy'}`);
  passed++;
} catch (err) {
  console.log(`  ✗ Health check via 127.0.0.1: FAILED — ${err.message}`);
  failed++;
}

// 5b: fetch() to localhost (what forwardSseRequest and fetchSessionListPayload use)
try {
  const res = await fetch(`http://${PROXY_HOST}:${upstreamPort}/config/providers`);
  await res.json();
  console.log(`  ✓ fetch() to ${PROXY_HOST}:${upstreamPort}/config/providers: OK`);
  passed++;
} catch (err) {
  console.log(`  ✗ fetch() to ${PROXY_HOST}:${upstreamPort}: FAILED — ${err.message}`);
  console.log('    ⚠️  This would break SSE forwarding and session listing');
  failed++;
}

// 5c: http.request() to localhost (what http-proxy-middleware uses internally)
try {
  const body = await new Promise((resolve, reject) => {
    const req = httpRequest(`http://${PROXY_HOST}:${upstreamPort}/config/providers`, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.end();
  });
  JSON.parse(body);
  console.log(`  ✓ http.request() to ${PROXY_HOST}:${upstreamPort}: OK`);
  passed++;
} catch (err) {
  console.log(`  ✗ http.request() to ${PROXY_HOST}:${upstreamPort}: FAILED — ${err.message} (${err.code})`);
  if (err.code === 'ECONNRESET') {
    console.log('    ⚠️  ECONNRESET reproduced! This is the issue in #1767.');
    console.log('    http.request() cannot connect while fetch() can.');
    console.log('    On Windows with IPv6, http.request() tries ::1 first (no server there)');
  }
  failed++;
}

// 5d: Session list through proxy (uses fetch directly)
try {
  const res = await fetch(`http://127.0.0.1:${proxyPort}/api/session`);
  await res.json();
  console.log('  ✓ Session list via proxy (fetch path): OK');
  passed++;
} catch (err) {
  console.log(`  ✗ Session list via proxy: FAILED — ${err.message}`);
  failed++;
}

// 5e: Generic API through proxy (uses http-proxy-middleware — the failing path in the issue)
try {
  const res = await fetch(`http://127.0.0.1:${proxyPort}/api/config/providers`);
  await res.json();
  console.log('  ✓ Generic API via http-proxy-middleware: OK');
  passed++;
} catch (err) {
  console.log(`  ✗ Generic API via http-proxy-middleware: FAILED — ${err.message}`);
  console.log('    ⚠️  This matches the issue behavior (proxy errors with ECONNRESET)');
  failed++;
}

// Cleanup
upstreamServer.close();
proxyServer.close();

console.log('\n' + '='.repeat(72));
console.log(`Tests: ${passed} passed, ${failed} failed`);
console.log('='.repeat(72));

console.log('\n=== ROOT CAUSE ANALYSIS ===');
console.log(`
The issue is that the OpenChamber web server (when run from the npm package,
not Electron) cannot proxy requests to the managed OpenCode process.

Three contributing factors were identified:

1. NO_PROXY env var is only set in Electron (main.mjs:1171-1172):
     process.env.NO_PROXY = process.env.NO_PROXY || 'localhost,127.0.0.1';
   The web/npm CLI does not set this. If the user has a system proxy
   (corporate/VPN), undici (Node 22 fetch) may route localhost through it.

2. Hostname mismatch: buildOpenCodeUrl() constructs URLs as:
     http://localhost:\${openCodePort}
   But OpenCode is started with --hostname 127.0.0.1 (IPv4 only).
   On Windows with IPv6 enabled, "localhost" can resolve to ::1 first,
   while OpenCode only listens on 127.0.0.1.

3. The SSE forwarder (forwardSseRequest) uses fetch() while the generic
   API proxy uses http-proxy-middleware (which uses http.request()).
   On Windows, these may handle dual-stack DNS resolution differently,
   explaining why the PushWatcher SSE connection succeeds but the proxy
   fails with ECONNRESET.

Suggested fix: Add NO_PROXY=localhost,127.0.0.1 to the web server's startup
(in index.js, similar to electron/main.mjs), and consider using 127.0.0.1
consistently instead of localhost in buildOpenCodeUrl().
`);

process.exit(failed > 0 ? 1 : 0);
