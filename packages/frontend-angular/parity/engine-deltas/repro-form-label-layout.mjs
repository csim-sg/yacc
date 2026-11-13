#!/usr/bin/env node
/**
 * Obscura engine delta 2 — inline label loses its layout box (#501; Stage 1
 * of #496). Upstream tracking: this is the measured real-world signature of
 * h4ckf0r0day/obscura#722 ("getBoundingClientRect returns 0x0 for inline
 * elements in a run that cannot fold").
 *
 * Reproduces, engine-only over raw CDP and without any app or suite file,
 * the layout delta behind the frozen anchor-green case
 * `should have proper form labels for accessibility`
 * (packages/frontend/tests/fe-002-login-ui.spec.ts:56): a static page
 * carries the login card's two labels whose class attributes are
 * byte-identical; the page ships no stylesheet at all (in the target build
 * the utility classes are inert). On a spec-conformant engine both labels
 * get a layout box. On obscura v0.2.6 the label whose run contains an
 * atomic inline `<input>` measures 0x0 with `offsetParent === null`
 * (text present, `display: inline`, connected) while the identically
 * classed label whose next sibling is a block `<div>` measures ~70x17 —
 * exactly the byte-identical-class split the app showed
 * (Email Address 0x0 vs Password 70x17).
 *
 * Exit codes (fail-closed, self-describing):
 *   0  every checked label has a non-zero layout box with a non-null
 *      offsetParent (engine healthy / fixed release)
 *   1  at least one label lost its layout box — the EXPECTED pre-fix state
 *      on v0.2.6 (digest sha256:76522dd288b0c...)
 *   2  usage/connectivity error
 *
 * Usage:
 *   node repro-form-label-layout.mjs --ws=http://127.0.0.2:9222 \
 *        --digest=sha256:76522dd288b0c0186b360fd6e6133ef55908e1fc3b9c4b7ad6240bf8682d998c
 *   (env: OBSCURA_WS, OBSCURA_DIGEST)
 */
import { Cdp, endpointFrom, digestFrom, fetchVersion, attachTab, servePage, report, finish } from './_cdp.mjs';

// Static replica of the target login card's label structure (Angular-free,
// class attributes kept as the case identity, deliberately no stylesheet —
// the utility classes carry no rules in the target build either).
const PAGE = `<!doctype html><html><head><meta charset="utf-8"><title>form-label-layout-repro</title></head>
<body>
  <form>
    <div>
      <label for="email" class="block text-sm font-medium text-base-content">Email Address</label>
      <input id="email" type="email" placeholder="Email Address" name="email" data-testid="login-email">
    </div>
    <div>
      <label for="password" class="block text-sm font-medium text-base-content">Password</label>
      <div>
        <input id="password" type="password" placeholder="Password" name="password" data-testid="login-password">
        <button type="button"></button>
      </div>
    </div>
  </form>
</body></html>`;

const root = endpointFrom(process.argv);
const digest = digestFrom(process.argv);
const httpRoot = root.replace(/^ws/, 'http').replace(/\/devtools\/browser.*$/, '');
try {
  await run(httpRoot, digest);
} catch (err) {
  console.error(`ERROR: ${err && err.message ? err.message : err}`);
  process.exit(2); // connectivity/CDP failure — never scored as either pass or defect
}

async function run(httpRoot, digest) {
const version = await fetchVersion(httpRoot);
console.log(`image digest (caller-supplied) : ${digest}`);

const cdp = await Cdp.connect(version.webSocketDebuggerUrl);
const page = await attachTab(cdp);
const server = await servePage(PAGE);

console.log('\nCHECK — every label has a non-zero layout box with a non-null offsetParent');
await page.navigate(`${server.origin}/`);
await new Promise((r) => setTimeout(r, 300));
const labels = await page.evaluateJson(`(() => {
  const out = [];
  for (const sel of ['label[for="email"]', 'label[for="password"]']) {
    const l = document.querySelector(sel);
    if (!l) { out.push({ sel, found: false }); continue; }
    const r = l.getBoundingClientRect();
    const cs = getComputedStyle(l);
    out.push({
      sel,
      found: true,
      text: (l.textContent || '').trim(),
      rect: { x: r.x, y: r.y, w: r.width, h: r.height },
      offsetParentNull: l.offsetParent === null,
      display: cs.display,
      connected: l.isConnected,
    });
  }
  return out;
})()`);

const defects = [];
for (const l of labels) {
  if (!l.found) {
    console.log(`  ${l.sel}: NOT FOUND (page under test did not render)`);
    defects.push(`${l.sel}: label missing from the static page`);
    continue;
  }
  const box = `${l.rect.w}x${l.rect.h} at (${l.rect.x},${l.rect.y})`;
  const healthy = l.rect.w > 0 && l.rect.h > 0 && !l.offsetParentNull;
  report(
    `non-zero box + offsetParent present (${l.text})`,
    `box > 0x0, offsetParent non-null, display inline, connected`,
    `box ${box}, offsetParent ${l.offsetParentNull ? 'null' : 'present'}, display ${l.display}, connected ${l.connected}`,
  );
  if (!healthy) defects.push(`${l.sel} ("${l.text}"): layout box ${box} with offsetParent ${l.offsetParentNull ? 'null' : 'present'} — label lost its layout box`);
}

server.close();
cdp.close();
console.log(`\nengine /json/version Browser: ${version.Browser}`);
console.log(`image digest               : ${digest}`);
finish(defects);
}
