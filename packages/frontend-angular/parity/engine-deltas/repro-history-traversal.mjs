#!/usr/bin/env node
/**
 * Obscura engine delta 1 — session-history traversal (#501; Stage 1 of #496).
 *
 * Reproduces, engine-only over raw CDP and without any app or suite file,
 * the two measured traversal defects behind the frozen tier-0 case
 * `ANG007-INBOX-1: filter/search/page URL writes replace browser history —
 * the whole filter session is one Back deep`
 * (packages/frontend/tests/inbox-shell-ang007.spec.ts:108):
 *
 *   CHECK 1 — JS `history.back()` must move the joint session-history
 *   index instead of appending a duplicate entry. On obscura v0.2.6 the
 *   popstate event fires and `location.href` reads the expected URL (and
 *   the page-visible `history.length` misleadingly stays flat), but the
 *   joint session history that CDP/Playwright navigate by —
 *   `Page.getNavigationHistory` — GROWS by one: the engine appended a
 *   duplicate of the destination entry and stepped currentIndex FORWARD
 *   onto the duplicate (Chrome: entry count unchanged, index decremented).
 *   A Back chain therefore never shortens — the app case's Back chain can
 *   never return to its bare entry.
 *
 *   CHECK 2 — CDP `Page.navigateToHistoryEntry` (what Playwright's
 *   `page.goBack()` executes) must be a same-document traversal. On
 *   obscura v0.2.6 it replaces the whole document (a `window` marker set
 *   before the back is gone), fires no popstate, and rewrites the entry
 *   list (Chrome: marker preserved, popstate fires, entries intact). In an
 *   SPA the reload re-initialises the framework at the restored URL — the
 *   measured `/login?p1` -> `/login?p1=` rewrite (Angular's init
 *   `replaceState(state, '', '')` + WHATWG serialization) and the
 *   INBOX-1 Back-chain landing on `/inbox?page=2&channel=telegram` are
 *   downstream effects of this; the rewrite itself is NOT claimed as an
 *   engine defect.
 *
 * Exit codes (fail-closed, self-describing):
 *   0  all checks passed (engine healthy for this delta / fixed release)
 *   1  at least one check observed the defective behaviour — the EXPECTED
 *      pre-fix state on v0.2.6 (digest sha256:76522dd288b0c...)
 *   2  usage/connectivity error
 *
 * Usage:
 *   node repro-history-traversal.mjs --ws=http://127.0.0.2:9222 \
 *        --digest=sha256:76522dd288b0c0186b360fd6e6133ef55908e1fc3b9c4b7ad6240bf8682d998c
 *   (env: OBSCURA_WS, OBSCURA_DIGEST)
 */
import { Cdp, endpointFrom, digestFrom, fetchVersion, attachTab, servePage, report, finish } from './_cdp.mjs';

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><title>history-traversal-repro</title></head>
<body>history traversal repro page</body></html>`;

const INIT_SCRIPT = `
  window.__popstateFired = false;
  window.addEventListener('popstate', () => { window.__popstateFired = true; });
`;

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
const page = await attachTab(cdp, INIT_SCRIPT);
const server = await servePage(PAGE);
const defects = [];
// ---------- CHECK 1: JS history.back() must not append a duplicate entry ----------
// The page-visible history.length hides the defect on obscura (it reports
// 4 -> 4); the joint session history that CDP/Playwright navigate by is the
// authority: Page.getNavigationHistory must keep the same entry count and
// move currentIndex back, not append a duplicate and step forward onto it.
console.log('\nCHECK 1 — JS history.back() moves the history index (no duplicate entry appended)');
await page.navigate(`${server.origin}/login`);
await page.evaluateJson(`history.pushState({}, '', '/login?p1')`);
await page.evaluateJson(`history.pushState({}, '', '/login?q1')`);
const histBefore = await cdp.send('Page.getNavigationHistory', {}, page.sessionId);
const popstateResult = await page.evaluateJson(
  `(() => new Promise((resolve) => {
     window.addEventListener('popstate', () => resolve('popstate fired'), { once: true });
     history.back();
     setTimeout(() => resolve('NO popstate within 6s'), 6000);
   }))()`,
);
await new Promise((r) => setTimeout(r, 400));
const histAfter = await cdp.send('Page.getNavigationHistory', {}, page.sessionId);
const pageLen = await page.evaluateJson('history.length');
const after = await page.evaluateJson(`({ href: location.href })`);
report(
  'popstate + entry count unchanged + index decremented + href restored to the pushed entry',
  `popstate fired; CDP entries ${histBefore.entries.length} (unchanged); currentIndex ${histBefore.currentIndex} -> ${histBefore.currentIndex - 1}; href ${server.origin}/login?p1`,
  `${popstateResult}; CDP entries ${histBefore.entries.length} -> ${histAfter.entries.length}; currentIndex -> ${histAfter.currentIndex}; page history.length ${pageLen}; href ${after.href}`,
);
if (histAfter.entries.length !== histBefore.entries.length) defects.push(`CHECK 1: joint session history grew ${histBefore.entries.length} -> ${histAfter.entries.length} — back appended a duplicate entry instead of moving the index (obscura: currentIndex stepped onto the appended duplicate; a Back chain therefore never shortens)`);
if (histAfter.currentIndex !== histBefore.currentIndex - 1) defects.push(`CHECK 1: currentIndex ${histBefore.currentIndex} -> ${histAfter.currentIndex} — the index did not move to the previous entry`);
if (!String(popstateResult).includes('popstate fired')) defects.push('CHECK 1: popstate not fired');
if (!after.href.endsWith('/login?p1')) defects.push('CHECK 1: href after back is not the pushed entry');

// ---------- CHECK 2: CDP navigateToHistoryEntry must be same-document traversal ----------
console.log('\nCHECK 2 — Page.navigateToHistoryEntry is a same-document traversal (marker survives, popstate fires)');
const page2 = await attachTab(cdp, INIT_SCRIPT); // fresh tab: isolated joint history
await page2.navigate(`${server.origin}/doc`);
await page2.evaluateJson(`window.__docMarker = 'SAME-DOCUMENT'; history.pushState({}, '', '/doc?p1'); history.pushState({}, '', '/doc?q1');`);
const hist2Before = await cdp.send('Page.getNavigationHistory', {}, page2.sessionId);
const prevEntry = hist2Before.entries[hist2Before.currentIndex - 1];
const traversed = page2.waitForEvent('Page.navigatedWithinDocument', 8000);
await cdp.send('Page.navigateToHistoryEntry', { entryId: prevEntry.id }, page2.sessionId);
await traversed;
await new Promise((r) => setTimeout(r, 400));
const hist2After = await cdp.send('Page.getNavigationHistory', {}, page2.sessionId);
const after2 = await page2.evaluateJson(
  `({ href: location.href, marker: window.__docMarker === undefined ? 'LOST (new document)' : window.__docMarker, popstate: window.__popstateFired === undefined ? 'unknown (new document)' : window.__popstateFired })`,
);
report(
  'marker preserved + popstate fired + entry count unchanged + href restored',
  `marker SAME-DOCUMENT; popstate true; CDP entries ${hist2Before.entries.length} (unchanged); href ${server.origin}/doc?p1`,
  `marker ${after2.marker}; popstate ${after2.popstate}; CDP entries ${hist2Before.entries.length} -> ${hist2After.entries.length} (currentIndex ${hist2After.currentIndex}); href ${after2.href}`,
);
if (after2.marker !== 'SAME-DOCUMENT') defects.push('CHECK 2: navigateToHistoryEntry replaced the document instead of traversing (window marker lost — in an SPA the framework re-initialises at the restored URL, e.g. the measured /login?p1 -> /login?p1= rewrite)');
if (after2.popstate !== true) defects.push('CHECK 2: popstate not fired by navigateToHistoryEntry');
if (hist2After.entries.length !== hist2Before.entries.length) defects.push(`CHECK 2: joint session history rewritten by navigateToHistoryEntry (${hist2Before.entries.length} -> ${hist2After.entries.length} entries)`);

server.close();
cdp.close();
console.log(`\nengine /json/version Browser: ${version.Browser}`);
console.log(`image digest               : ${digest}`);
finish(defects);
}
