#!/usr/bin/env node
/**
 * ANG-015 (#385) — validation for `merge-browser-reports.mjs` (PB-2 aggregation).
 *
 * Focused, fast (no browsers, no backend, no network) fail-closed validation of
 * the per-browser report merge + the comparator contract:
 *
 *   1.  Happy path — three synthetic per-browser reports (native Playwright
 *       JSON shape) merge into one report with the exact union of rows and a
 *       provenance block.
 *   2.  Round-trip identity — a native-style multi-project report split back
 *       into per-browser reports merges to the identical row multiset.
 *   3–9. Failure paths — every fail-closed branch exits non-zero with the
 *       designed message: absent report, mis-scoped row, cross-browser case-set
 *       mismatch, duplicate row, empty suites, corrupt JSON, undeclared/missing
 *       project vs gate-scope.anchor.projects.
 *   10. Comparator compatibility (real data, opt-in) — set
 *       MERGE_VALIDATE_REAL_REPORT=/path/to/full-3-browser/parity-run.json and
 *       the validator splits it per project, merges it, and asserts the REAL
 *       comparator (`compare-baseline.mjs compare`) produces the identical
 *       verdict buckets on the merged report as on the original. This proves
 *       the aggregation is lossless under the actual gate decision.
 *
 * Run: node packages/frontend-angular/parity/validate-merge-browser-reports.mjs
 * (exit 0 = all validations pass; any assertion aborts non-zero)
 *
 * Zero dependencies. Test fixtures live in a mkdtemp dir and are cleaned up.
 */
'use strict';

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const MERGE = join(SCRIPT_DIR, 'merge-browser-reports.mjs');
const COMPARATOR = join(SCRIPT_DIR, 'compare-baseline.mjs');
const GATE_SCOPE = join(SCRIPT_DIR, 'gate-scope.json');

const passed = [];
function ok(name, fn) {
  fn();
  passed.push(name);
  process.stdout.write(`  ok - ${name}\n`);
}

// --- synthetic native-shape report builder -----------------------------------

/** Build a native-shaped single-project report from flat case descriptors. */
function makeReport(project, cases, stats) {
  const byFile = new Map();
  for (const c of cases) {
    if (!byFile.has(c.file)) byFile.set(c.file, { title: c.file, file: c.file, specs: [], suites: [] });
    const top = byFile.get(c.file);
    let parent = top;
    const describes = c.describes ?? [];
    describes.forEach((title) => {
      let child = parent.suites.find((s) => s.title === title && s.file === c.file);
      if (!child) {
        child = { title, file: c.file, specs: [], suites: [] };
        parent.suites.push(child);
      }
      parent = child;
    });
    parent.specs.push({
      title: c.title,
      ok: c.status === 'expected',
      tags: [],
      tests: [
        {
          timeout: 30_000,
          annotations: [],
          expectedStatus: 'expected',
          projectId: `${project}-id`,
          projectName: c.projectName ?? project,
          results: c.results ?? [{ status: c.status === 'expected' ? 'passed' : c.status, duration: c.duration ?? 5, retry: 0 }],
          status: c.status,
        },
      ],
      id: `${c.file}|${describes.join('>')}|${c.title}|${project}`.length + '-' + `${c.title}-${project}`.length,
      file: c.file,
      line: c.line ?? 10,
      column: 3,
    });
  }
  return {
    suites: [...byFile.values()],
    errors: [],
    stats: stats ?? {
      startTime: '2026-10-21T00:00:00.000Z',
      duration: cases.length * 1000,
      expected: cases.filter((c) => c.status === 'expected').length,
      unexpected: cases.filter((c) => c.status !== 'expected').length,
      flaky: 0,
      skipped: 0,
    },
  };
}

const CASES = [
  { file: 'tests/alpha.spec.ts', title: 'case one', status: 'expected' },
  { file: 'tests/alpha.spec.ts', title: 'case two', status: 'unexpected', describes: ['Group A'] },
  { file: 'tests/alpha.spec.ts', title: 'case three', status: 'expected', describes: ['Group A', 'Group B'] },
  { file: 'e2e/beta.e2e.ts', title: 'beta case', status: 'expected' },
  { file: 'e2e/beta.e2e.ts', title: 'beta skip', status: 'skipped' },
  { file: 'tests/gamma.spec.ts', title: 'gamma case', status: 'unexpected', results: [{ status: 'timedOut', duration: 30_000, retry: 0 }] },
];
const PROJECTS = ['chromium', 'firefox', 'webkit'];

/** Row multiset of a report, computed independently of the merge script. */
function rowsOf(report) {
  const out = [];
  const walk = (suite, path) => {
    const current = path.concat(suite.title ?? []);
    for (const spec of suite.specs ?? []) {
      const describes = current.filter((t) => t && t !== spec.file);
      for (const test of spec.tests ?? []) {
        out.push(`${test.projectName}|${spec.file}|${describes.join(' > ')}|${spec.title}|${test.status}`);
      }
    }
    for (const child of suite.suites ?? []) walk(child, current);
  };
  for (const top of report.suites) walk(top, []);
  return out.sort();
}

/** Split a native multi-project report into per-project reports. */
function splitByProject(report, projects) {
  const keepSpec = (spec, project) => {
    const kept = (spec.tests ?? []).filter((t) => t.projectName === project);
    return kept.length ? { ...spec, tests: kept } : null;
  };
  const filterSuite = (suite, project) => {
    const specs = (suite.specs ?? []).map((s) => keepSpec(s, project)).filter(Boolean);
    const suites = (suite.suites ?? []).map((s) => filterSuite(s, project)).filter((s) => s.specs.length + s.suites.length > 0);
    return { ...suite, specs, suites };
  };
  const filtered = projects.map((project) => report.suites.map((top) => filterSuite(top, project)));
  return projects.map((p, idx) => ({ suites: filtered[idx], errors: [], stats: { ...report.stats } }));
}

function runMerge(tmp, entries, outName) {
  const out = join(tmp, outName);
  const args = [MERGE, '--gate-scope', GATE_SCOPE, '--out', out];
  for (const [project, file] of entries) args.push('--project', `${project}=${file}`);
  return { res: spawnSync(process.execPath, args, { encoding: 'utf8' }), out };
}

// --- main ---------------------------------------------------------------------

const tmp = mkdtempSync(join(tmpdir(), 'merge-validate-'));
try {
  const perProject = Object.fromEntries(PROJECTS.map((p) => [p, join(tmp, `${p}.json`)]));
  for (const p of PROJECTS) writeFileSync(perProject[p], JSON.stringify(makeReport(p, CASES)));

  ok('happy path: three per-browser reports merge to the exact row union', () => {
    const { res, out } = runMerge(tmp, PROJECTS.map((p) => [p, perProject[p]]), 'merged.json');
    assert.equal(res.status, 0, `merge failed: ${res.stderr}`);
    const merged = JSON.parse(readFileSync(out, 'utf8'));
    const expectedRows = CASES.flatMap((c) => PROJECTS.map((p) => `${p}|${c.file}|${(c.describes ?? []).join(' > ')}|${c.title}|${c.status}`)).sort();
    assert.deepEqual(rowsOf(merged), expectedRows);
    assert.equal(merged.merge.sources.length, 3);
    for (const src of merged.merge.sources) {
      assert.match(src.sha256, /^[0-9a-f]{64}$/);
      assert.equal(src.rows, CASES.length);
    }
    assert.equal(merged.merge.totalRows, CASES.length * 3);
    // results pass through untouched (duration + status preserved)
    const first = merged.suites[0].specs[0].tests[0];
    assert.equal(first.results[0].duration, 5);
  });

  ok('round-trip: native multi-project report -> split -> merge = identical rows', () => {
    const native = { suites: [], errors: [], stats: { startTime: '2026-10-21T00:00:00.000Z', duration: 6000, expected: 12, unexpected: 6, flaky: 0, skipped: 0 } };
    for (const p of PROJECTS) native.suites.push(...makeReport(p, CASES).suites);
    const splits = splitByProject(native, PROJECTS);
    const splitPaths = PROJECTS.map((p, i) => {
      const f = join(tmp, `split-${p}.json`);
      writeFileSync(f, JSON.stringify(splits[i]));
      return [p, f];
    });
    const { res, out } = runMerge(tmp, splitPaths, 'roundtrip.json');
    assert.equal(res.status, 0, `merge failed: ${res.stderr}`);
    assert.deepEqual(rowsOf(JSON.parse(readFileSync(out, 'utf8'))), rowsOf(native));
  });

  ok('fail-closed: absent report for a declared browser', () => {
    const { res } = runMerge(tmp, [['chromium', perProject.chromium], ['firefox', perProject.firefox]], 'missing.json');
    assert.notEqual(res.status, 0);
    assert.match(res.stderr, /missing per-browser report\(s\) for declared project\(s\): webkit/);
  });

  ok('fail-closed: undeclared extra project vs gate-scope.anchor.projects', () => {
    const rogue = join(tmp, 'rogue.json');
    writeFileSync(rogue, JSON.stringify(makeReport('safari', CASES)));
    const { res } = runMerge(tmp, [...PROJECTS.map((p) => [p, perProject[p]]), ['safari', rogue]], 'extra.json');
    assert.notEqual(res.status, 0);
    assert.match(res.stderr, /undeclared --project entries.*safari/);
  });

  ok('fail-closed: mis-scoped row (foreign project inside a browser report)', () => {
    const polluted = join(tmp, 'polluted-firefox.json');
    writeFileSync(polluted, JSON.stringify(makeReport('firefox', CASES, undefined)));
    const report = JSON.parse(readFileSync(polluted, 'utf8'));
    report.suites[0].specs[0].tests[0].projectName = 'webkit';
    writeFileSync(polluted, JSON.stringify(report));
    const { res } = runMerge(tmp, [['chromium', perProject.chromium], ['firefox', polluted], ['webkit', perProject.webkit]], 'polluted.json');
    assert.notEqual(res.status, 0);
    assert.match(res.stderr, /mis-scoped run/);
  });

  ok('fail-closed: cross-browser case-set mismatch (a browser ran less than the full suite)', () => {
    const short = join(tmp, 'short-webkit.json');
    writeFileSync(short, JSON.stringify(makeReport('webkit', CASES.slice(0, CASES.length - 1))));
    const { res } = runMerge(tmp, [['chromium', perProject.chromium], ['firefox', perProject.firefox], ['webkit', short]], 'short.json');
    assert.notEqual(res.status, 0);
    assert.match(res.stderr, /per-browser case sets differ between "chromium" and "webkit"/);
    assert.match(res.stderr, /only in chromium/);
  });

  ok('fail-closed: duplicate row inside a report', () => {
    const dup = join(tmp, 'dup-chromium.json');
    const report = makeReport('chromium', CASES);
    report.suites[0].specs.push(JSON.parse(JSON.stringify(report.suites[0].specs[0])));
    writeFileSync(dup, JSON.stringify(report));
    const { res } = runMerge(tmp, [['chromium', dup], ['firefox', perProject.firefox], ['webkit', perProject.webkit]], 'dup.json');
    assert.notEqual(res.status, 0);
    assert.match(res.stderr, /duplicate row/);
  });

  ok('fail-closed: empty suites and corrupt JSON', () => {
    const empty = join(tmp, 'empty-webkit.json');
    writeFileSync(empty, JSON.stringify({ suites: [], errors: [], stats: {} }));
    const { res: r1 } = runMerge(tmp, [['chromium', perProject.chromium], ['firefox', perProject.firefox], ['webkit', empty]], 'empty.json');
    assert.notEqual(r1.status, 0);
    assert.match(r1.stderr, /zero test rows/);

    const corrupt = join(tmp, 'corrupt-webkit.json');
    writeFileSync(corrupt, '{ "suites": [');
    const { res: r2 } = runMerge(tmp, [['chromium', perProject.chromium], ['firefox', perProject.firefox], ['webkit', corrupt]], 'corrupt.json');
    assert.notEqual(r2.status, 0);
    assert.match(r2.stderr, /absent or not valid JSON/);
  });

  ok('comparator compatibility: merged report drives the real comparator (synthetic data, tamper detection intact)', () => {
    // The merged synthetic report has no anchor rows -> the comparator must
    // fail CLOSED with its missing-anchored-case violations (not silently pass
    // or crash differently from a native report).
    const { out } = runMerge(tmp, PROJECTS.map((p) => [p, perProject[p]]), 'synthetic-for-comparator.json');
    const res = spawnSync(process.execPath, [COMPARATOR, 'compare', '--gate-scope', GATE_SCOPE, '--json-report', out, '--report', join(tmp, 'synthetic-verdict.json')], { encoding: 'utf8' });
    assert.equal(res.status, 1, `comparator should exit 1 on a scopeless synthetic report, got ${res.status}: ${res.stdout} ${res.stderr}`);
    const verdict = JSON.parse(readFileSync(join(tmp, 'synthetic-verdict.json'), 'utf8'));
    assert.ok(verdict.violations.some((v) => v.includes('unknown unanchored file')), 'synthetic files must surface as scope violations');
    assert.ok(verdict.totals.runRows === CASES.length * 3, 'comparator must see every merged row');
  });

  const realReport = process.env.MERGE_VALIDATE_REAL_REPORT;
  if (realReport) {
    ok(`comparator verdict identity on the REAL report (${realReport})`, () => {
      const native = JSON.parse(readFileSync(resolve(realReport), 'utf8'));
      const splits = splitByProject(native, PROJECTS);
      const splitPaths = PROJECTS.map((p, i) => {
        const f = join(tmp, `real-split-${p}.json`);
        writeFileSync(f, JSON.stringify(splits[i]));
        return [p, f];
      });
      const { res, out } = runMerge(tmp, splitPaths, 'real-merged.json');
      assert.equal(res.status, 0, `merge failed: ${res.stderr}`);
      assert.deepEqual(rowsOf(JSON.parse(readFileSync(out, 'utf8'))), rowsOf(native), 'merged rows must equal the native report rows');
      const runCompare = (reportPath, verdictPath) =>
        spawnSync(process.execPath, [COMPARATOR, 'compare', '--gate-scope', GATE_SCOPE, '--json-report', reportPath, '--report', verdictPath], { encoding: 'utf8' });
      const a = runCompare(resolve(realReport), join(tmp, 'verdict-native.json'));
      const b = runCompare(out, join(tmp, 'verdict-merged.json'));
      assert.equal(a.status, b.status, `comparator exit codes must match (${a.status} vs ${b.status})`);
      // The comparator emits bucket arrays in report row order, which differs
      // between a native multi-project report and the merged concatenation —
      // the verdict is identical as a SET. Compare buckets order-insensitively.
      const pick = (file) => {
        const v = JSON.parse(readFileSync(file, 'utf8'));
        delete v.generatedAt;
        for (const key of Object.keys(v)) {
          if (Array.isArray(v[key])) v[key] = [...v[key]].sort();
        }
        return v;
      };
      const merged = pick(join(tmp, 'verdict-merged.json'));
      const nativeVerdict = pick(join(tmp, 'verdict-native.json'));
      assert.deepEqual(merged.totals, nativeVerdict.totals, 'totals must be identical');
      for (const key of Object.keys(nativeVerdict)) {
        if (key === 'totals' || key === 'anchor' || key === 'gateScope') continue;
        assert.deepEqual(merged[key], nativeVerdict[key], `verdict bucket "${key}" must be identical`);
      }
    });
  } else {
    process.stdout.write(`  skip - real-report comparator verdict identity (set MERGE_VALIDATE_REAL_REPORT=<full parity-run.json> to enable)\n`);
  }

  process.stdout.write(`\n[validate-merge-browser-reports] ${passed.length} validation(s) passed.\n`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
