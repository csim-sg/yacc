#!/usr/bin/env node
/**
 * Shared plumbing for the Obscura engine-delta reproductions (#501, Stage 1
 * of #496). Zero external dependencies: Node >= 22 built-ins only (the
 * global `WebSocket` client and `fetch`, plus `node:http`).
 *
 * Everything here talks raw Chrome DevTools Protocol to an already-running
 * engine endpoint. No app, no frozen suite file, and no Playwright test
 * file is involved. The engine's own release version is NOT exposed over
 * CDP (obscura's `/json/version` impersonates a Chrome build), so the
 * image digest is supplied by the caller (`--digest` / `OBSCURA_DIGEST`)
 * and printed alongside whatever the endpoint reports — the digest is the
 * authoritative pin identity.
 */
import http from 'node:http';

/** Minimal CDP-over-WebSocket client (browser-level session + flattening). */
export class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = [];
  }

  /** Connect to a browser-level debugger URL (`.../devtools/browser`). */
  static async connect(url, { headers } = {}) {
    // Node's global WebSocket has no header support; auth-protected
    // endpoints therefore need a URL that already carries the token
    // (loopback-range binds are auth-exempt in obscura, which is how the
    // local evidence runs avoid handling any token at all).
    if (headers && Object.keys(headers).length > 0) {
      throw new Error('Custom WS headers are not supported by this zero-dependency client; use an auth-exempt loopback bind.');
    }
    const ws = new WebSocket(url);
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve, { once: true });
      ws.addEventListener('error', () => reject(new Error(`WebSocket connect failed: ${url}`)), { once: true });
    });
    const client = new Cdp(ws);
    ws.addEventListener('message', (ev) => {
      if (typeof ev.data === 'string') client.dispatch(ev.data);
    });
    return client;
  }

  /** Fire a CDP command and resolve its result (rejects on error responses). */
  send(method, params = {}, sessionId) {
    const id = this.nextId++;
    const msg = { id, method, params };
    if (sessionId) msg.sessionId = sessionId;
    this.ws.send(JSON.stringify(msg));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject, method }));
  }

  /** Register a callback for every event message. */
  on(fn) {
    this.listeners.push(fn);
  }

  /** Route one raw WS message frame. */
  dispatch(raw) {
    const msg = JSON.parse(raw);
    if (msg.id && this.pending.has(msg.id)) {
      const p = this.pending.get(msg.id);
      this.pending.delete(msg.id);
      if (msg.error) p.reject(new Error(`${p.method} -> ${JSON.stringify(msg.error)}`));
      else p.resolve(msg.result);
    } else if (msg.method) {
      for (const fn of this.listeners) fn(msg);
    }
  }

  close() {
    this.ws.close();
  }
}

/** Resolve `--ws` / `OBSCURA_WS` (a loopback http or ws endpoint root). */
export function endpointFrom(argv) {
  const flag = argv.find((a) => a.startsWith('--ws='));
  const raw = flag ? flag.slice('--ws='.length) : process.env.OBSCURA_WS;
  if (!raw) {
    console.error('ERROR: no engine endpoint. Pass --ws=http://127.0.0.2:9222 or set OBSCURA_WS.');
    process.exit(2);
  }
  return raw;
}

/** Resolve `--digest` / `OBSCURA_DIGEST` (image sha256:..., optional but recorded). */
export function digestFrom(argv) {
  const flag = argv.find((a) => a.startsWith('--digest='));
  const raw = flag ? flag.slice('--digest='.length) : process.env.OBSCURA_DIGEST;
  if (!raw) {
    console.error('ERROR: no image digest recorded. Pass --digest=sha256:... or set OBSCURA_DIGEST.');
    process.exit(2);
  }
  return raw;
}

/** GET `<root>/json/version` and print it; the release version is not exposed. */
export async function fetchVersion(httpRoot) {
  const res = await fetch(`${httpRoot}/json/version`);
  const version = await res.json();
  console.log(`engine /json/version : ${JSON.stringify(version)}`);
  return version;
}

/**
 * Attach one fresh tab and return { cdp, sessionId, close }.
 * `initScript` (optional) runs in every new document before app scripts.
 */
export async function attachTab(cdp, initScript) {
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  const events = [];
  cdp.on((m) => {
    if (m.sessionId === sessionId) events.push(m);
  });
  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Runtime.enable', {}, sessionId);
  if (initScript) {
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: initScript }, sessionId);
  }
  return {
    sessionId,
    events,
    waitForEvent(method, timeoutMs = 20000) {
      return new Promise((resolve, reject) => {
        const found = events.find((e) => e.method === method);
        if (found) return resolve(found);
        const t = setTimeout(() => reject(new Error(`timeout waiting for ${method}`)), timeoutMs);
        cdp.on((m) => {
          if (m.sessionId === sessionId && m.method === method) {
            clearTimeout(t);
            resolve(m);
          }
        });
      });
    },
    async navigate(url) {
      const loaded = this.waitForEvent('Page.loadEventFired');
      await cdp.send('Page.navigate', { url }, sessionId);
      await loaded;
    },
    async evaluateJson(expression) {
      const r = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId);
      if (r.exceptionDetails) {
        throw new Error(`evaluate threw: ${JSON.stringify(r.exceptionDetails.exception?.description || r.exceptionDetails)}`);
      }
      return r.result.value;
    },
  };
}

/**
 * Serve `html` for every path on 127.0.0.1:<ephemeral port> and return the
 * origin. One tiny page server keeps both repros app-free and self-contained.
 */
export async function servePage(html) {
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(html);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return {
    origin: `http://127.0.0.1:${port}`,
    close: () => server.close(),
  };
}

/** Print one expected-vs-observed line pair. */
export function report(label, expected, observed) {
  console.log(`  EXPECTED (${label}): ${expected}`);
  console.log(`  OBSERVED           : ${observed}`);
}

/** Standard fail-closed exit: 0 = engine behaves to spec, 1 = defect observed, 2 = usage. */
export function finish(defects) {
  if (defects.length > 0) {
    console.log(`\nRESULT: DEFECT PRESENT — ${defects.length} check(s) failed (exit 1).`);
    process.exit(1);
  }
  console.log('\nRESULT: ALL CHECKS PASSED (exit 0) — engine behaves to spec for this delta.');
  process.exit(0);
}
