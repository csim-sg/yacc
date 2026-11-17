#!/usr/bin/env node
/**
 * ANG-015 (#385) — validation for `merge-browser-reports.mjs` + the
 * engine-scoped comparator contract (PB-2 aggregation, AM-10 engine coverage).
 *
 * Focused, fast (no browsers, no backend, no network) fail-closed validation:
 *
 *   1.  Happy path — the declared CI engine set (gate-scope.json ciEngines,
 *       exactly {webkit} under AM-10) merges into one report with the exact
 *       union of rows, a provenance block and the declared engine→anchor
 *       mapping.
 *   2.  Round-trip identity — a native per-engine report split back out of a
 *       multi-project report merges to the identical row multiset (vacuous
 *       case-set rule for n=1 exercised).
 *   3–8. Failure paths — every fail-closed branch exits non-zero with the
 *       designed message: absent declared-engine report, undeclared extra
 *       engine, mis-scoped foreign-projectName row, duplicate row, empty
 *       suites / corrupt JSON, and the cross-engine identical-case-set rule
 *       still enforced under a multi-engine declaration (never silently
 *       deleted for future multi-engine use).
 *   9.  Comparator compatibility (real data) — the merged webkit-only
 *       synthetic report drives the REAL comparator against the REAL
 *       gate-scope/anchor and fails closed exactly like a native report.
 *   10–17. Comparator-side engine-scope contract on a synthetic anchor:
 *       positive single-engine verdict (no missing-result for other-project
 *       anchor rows; engine-scoped required-row accounting); foreign
 *       projectName rejected; missing declared-engine row rejected; a wrong
 *       engine→anchor mapping fails closed; absent/empty ciEngines rejected
 *       on BOTH scripts; zero-row report rejected by the comparator; extra
 *       anchor row beyond the declared shape rejected by anchor validation.
 *   18. Comparator verdict identity on the REAL committed 3-project anchor
 *       report: the declared-engine projection of the real report merges to
 *       the identical rows and the real comparator produces the identical
 *       verdict on both (proving the aggregation is lossless under the
 *       actual gate decision). Override the input with
 *       MERGE_VALIDATE_REAL_REPORT=/path/to/report.json.
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

const GATE_SCOPE_JSON = JSON.parse(readFileSync(GATE_SCOPE, 'utf8'));
// The declared CI engine set is read from the live gate-scope, never
// hardcoded — the harness validates whatever the gate declares.
const DECLARED_ENGINES = GATE_SCOPE_JSON.ciEngines;
const ANCHOR_PROJECT_BY_ENGINE = GATE_SCOPE_JSON.anchorProjectByEngine;
assert.ok(Array.isArray(DECLARED_ENGINES) && DECLARED_ENGINES.length > 0, 'gate-scope must declare ciEngines');
assert.ok(ANCHOR_PROJECT_BY_ENGINE && typeof ANCHOR_PROJECT_BY_ENGINE === 'object', 'gate-scope must declare anchorProjectByEngine');

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
const ALL_PROJECTS = [...new Set([...GATE_SCOPE_JSON.anchor.projects, ...DECLARED_ENGINES])];

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

function runMerge(tmp, entries, outName, gateScope = GATE_SCOPE) {
  const out = join(tmp, outName);
  const args = [MERGE, '--gate-scope', gateScope, '--out', out];
  for (const [project, file] of entries) args.push('--project', `${project}=${file}`);
  return { res: spawnSync(process.execPath, args, { encoding: 'utf8' }), out };
}

function runCompare(tmp, reportPath, verdictName, gateScope = GATE_SCOPE) {
  const verdict = join(tmp, verdictName);
  const res = spawnSync(
    process.execPath,
    [COMPARATOR, 'compare', '--gate-scope', gateScope, '--json-report', reportPath, '--report', verdict],
    { encoding: 'utf8' },
  );
  return { res, verdict };
}

// --- synthetic anchor + gate-scope fixtures (comparator-side engine scope) ----

// Synthetic anchor: chromium + webkit projects, three rows. The webkit rows
// are exactly what a declared webkit engine must answer; the chromium row is
// anchor provenance outside the declared engine mapping.
const SYNTH_ANCHOR_ROWS = [
  ['chromium', 'tests/alpha.spec.ts', 'passed', '0', '5', 'case one', 'tests/alpha.spec.ts'],
  ['webkit', 'tests/alpha.spec.ts', 'passed', '0', '5', 'case one', 'tests/alpha.spec.ts'],
  ['webkit', 'tests/alpha.spec.ts', 'failed', '0', '5', 'case two', 'tests/alpha.spec.ts > Group A'],
];
const SYNTH_RUN_CASES = [
  { file: 'tests/alpha.spec.ts', title: 'case one', status: 'expected' },
  { file: 'tests/alpha.spec.ts', title: 'case two', status: 'unexpected', describes: ['Group A'] },
];

function writeSyntheticScope(tmp, name, overrides = {}) {
  const scope = {
    decision: 'SYNTHETIC-ENGINE-SCOPE',
    testRoot: 'packages/frontend',
    ciEngines: ['webkit'],
    anchorProjectByEngine: { webkit: 'webkit' },
    runMatch: ['tests/**/*.spec.ts'],
    excludedDebugSpecs: [],
    supersededWrappers: [],
    anchor: {
      id: 'synthetic-engine-scope',
      kind: 'synthetic fixture',
      appSha: 'a'.repeat(40),
      javaSha: 'a'.repeat(40),
      capturedAt: '2026-11-17',
      perCaseListing: join(tmp, `${name}-anchor.tsv`),
      declaredRows: SYNTH_ANCHOR_ROWS.length,
      declaredCounts: { passed: 2, failed: 1, timedOut: 0, skipped: 0, flaky: 0 },
      projects: ['chromium', 'webkit'],
      tier1AllGreen: [],
      sha256: {},
    },
    anchorRedClasses: { Z: { meaning: 'synthetic fixture', files: ['alpha.spec.ts'] } },
    unanchoredKnownFiles: { 'e2e-promotion': [], 'angular-native-tier0': [] },
    ...overrides,
  };
  const path = join(tmp, `${name}-gate-scope.json`);
  writeFileSync(scope.anchor.perCaseListing, ['project\tfile\tstatus\tretries\tduration_ms\ttest\tsuite-path', ...SYNTH_ANCHOR_ROWS.map((r) => r.join('\t'))].join('\n') + '\n');
  writeFileSync(path, JSON.stringify(scope, null, 2));
  return path;
}

// --- main ---------------------------------------------------------------------

const tmp = mkdtempSync(join(tmpdir(), 'merge-validate-'));
try {
  const perProject = Object.fromEntries(ALL_PROJECTS.map((p) => [p, join(tmp, `${p}.json`)]));
  for (const p of ALL_PROJECTS) writeFileSync(perProject[p], JSON.stringify(makeReport(p, CASES)));

  ok(`happy path: the declared engine set (${DECLARED_ENGINES.join(', ')}) merges to the exact row union with the declared engine→anchor mapping`, () => {
    const { res, out } = runMerge(tmp, DECLARED_ENGINES.map((p) => [p, perProject[p]]), 'merged.json');
    assert.equal(res.status, 0, `merge failed: ${res.stderr}`);
    assert.match(res.stdout, /engine coverage \(AM-10\): webkit -> anchor webkit/);
    const merged = JSON.parse(readFileSync(out, 'utf8'));
    const expectedRows = CASES.flatMap((c) => DECLARED_ENGINES.map((p) => `${p}|${c.file}|${(c.describes ?? []).join(' > ')}|${c.title}|${c.status}`)).sort();
    assert.deepEqual(rowsOf(merged), expectedRows);
    assert.equal(merged.merge.sources.length, DECLARED_ENGINES.length);
    assert.deepEqual(merged.merge.engineCoverage, DECLARED_ENGINES.map((engine) => ({ engine, anchorProject: ANCHOR_PROJECT_BY_ENGINE[engine] })));
    for (const src of merged.merge.sources) {
      assert.match(src.sha256, /^[0-9a-f]{64}$/);
      assert.equal(src.rows, CASES.length);
    }
    assert.equal(merged.merge.totalRows, CASES.length * DECLARED_ENGINES.length);
    // results pass through untouched (duration + status preserved)
    const first = merged.suites[0].specs[0].tests[0];
    assert.equal(first.results[0].duration, 5);
  });

  ok('round-trip: native multi-project report -> declared-engine split -> merge = identical rows (n=1 case-set rule vacuous)', () => {
    const native = { suites: [], errors: [], stats: { startTime: '2026-10-21T00:00:00.000Z', duration: 6000, expected: 4, unexpected: 2, flaky: 0, skipped: 0 } };
    for (const p of DECLARED_ENGINES) native.suites.push(...makeReport(p, CASES).suites);
    const splits = splitByProject(native, DECLARED_ENGINES);
    const splitPaths = DECLARED_ENGINES.map((p, i) => {
      const f = join(tmp, `split-${p}.json`);
      writeFileSync(f, JSON.stringify(splits[i]));
      return [p, f];
    });
    const { res, out } = runMerge(tmp, splitPaths, 'roundtrip.json');
    assert.equal(res.status, 0, `merge failed: ${res.stderr}`);
    assert.deepEqual(rowsOf(JSON.parse(readFileSync(out, 'utf8'))), rowsOf(native));
  });

  ok('fail-closed: absent report for a declared CI engine', () => {
    const { res } = runMerge(tmp, [], 'missing.json');
    assert.notEqual(res.status, 0);
    assert.match(res.stderr, new RegExp(`missing per-engine report\\(s\\) for declared CI engine\\(s\\): ${DECLARED_ENGINES.join(', ')}`));
  });

  ok('fail-closed: undeclared extra engine (not in gate-scope.ciEngines)', () => {
    const rogue = join(tmp, 'rogue.json');
    writeFileSync(rogue, JSON.stringify(makeReport('safari', CASES)));
    const { res } = runMerge(tmp, [...DECLARED_ENGINES.map((p) => [p, perProject[p]]), ['safari', rogue]], 'extra.json');
    assert.notEqual(res.status, 0);
    assert.match(res.stderr, /undeclared --project entries.*safari/);
  });

  ok('fail-closed: mis-scoped row (foreign projectName inside a declared-engine report)', () => {
    const polluted = join(tmp, `polluted-${DECLARED_ENGINES[0]}.json`);
    writeFileSync(polluted, JSON.stringify(makeReport(DECLARED_ENGINES[0], CASES)));
    const report = JSON.parse(readFileSync(polluted, 'utf8'));
    report.suites[0].specs[0].tests[0].projectName = 'chromium';
    writeFileSync(polluted, JSON.stringify(report));
    const { res } = runMerge(tmp, DECLARED_ENGINES.map((p) => [p, p === DECLARED_ENGINES[0] ? polluted : perProject[p]]), 'polluted.json');
    assert.notEqual(res.status, 0);
    assert.match(res.stderr, /mis-scoped run/);
  });

  ok('fail-closed: duplicate row inside a report', () => {
    const dup = join(tmp, `dup-${DECLARED_ENGINES[0]}.json`);
    const report = makeReport(DECLARED_ENGINES[0], CASES);
    report.suites[0].specs.push(JSON.parse(JSON.stringify(report.suites[0].specs[0])));
    writeFileSync(dup, JSON.stringify(report));
    const { res } = runMerge(tmp, DECLARED_ENGINES.map((p) => [p, dup]), 'dup.json');
    assert.notEqual(res.status, 0);
    assert.match(res.stderr, /duplicate row/);
  });

  ok('fail-closed: empty suites and corrupt JSON', () => {
    const empty = join(tmp, `empty-${DECLARED_ENGINES[0]}.json`);
    writeFileSync(empty, JSON.stringify({ suites: [], errors: [], stats: {} }));
    const { res: r1 } = runMerge(tmp, DECLARED_ENGINES.map((p) => [p, empty]), 'empty.json');
    assert.notEqual(r1.status, 0);
    assert.match(r1.stderr, /zero test rows/);

    const corrupt = join(tmp, `corrupt-${DECLARED_ENGINES[0]}.json`);
    writeFileSync(corrupt, '{ "suites": [');
    const { res: r2 } = runMerge(tmp, DECLARED_ENGINES.map((p) => [p, corrupt]), 'corrupt.json');
    assert.notEqual(r2.status, 0);
    assert.match(r2.stderr, /absent or not valid JSON/);
  });

  ok('fail-closed: the identical-case-set rule survives under a multi-engine declaration (never deleted)', () => {
    const multi = writeSyntheticScope(tmp, 'multi', {
      ciEngines: ['webkit', 'chromium'],
      anchorProjectByEngine: { webkit: 'webkit', chromium: 'chromium' },
    });
    const short = join(tmp, 'short-chromium.json');
    writeFileSync(short, JSON.stringify(makeReport('chromium', CASES.slice(0, CASES.length - 1))));
    const { res } = runMerge(tmp, [['webkit', perProject.webkit], ['chromium', short]], 'multi-short.json', multi);
    assert.notEqual(res.status, 0);
    assert.match(res.stderr, /per-engine case sets differ between "webkit" and "chromium"/);
    assert.match(res.stderr, /only in webkit/);
  });

  ok('comparator compatibility: merged report drives the real comparator (synthetic data, tamper detection intact)', () => {
    // The merged synthetic report has no anchor rows -> the comparator must
    // fail CLOSED with its missing-anchored-case violations (not silently pass
    // or crash differently from a native report).
    const { out } = runMerge(tmp, DECLARED_ENGINES.map((p) => [p, perProject[p]]), 'synthetic-for-comparator.json');
    const { res, verdict } = runCompare(tmp, out, 'synthetic-verdict.json');
    assert.equal(res.status, 1, `comparator should exit 1 on a scopeless synthetic report, got ${res.status}: ${res.stdout} ${res.stderr}`);
    const v = JSON.parse(readFileSync(verdict, 'utf8'));
    assert.ok(v.violations.some((x) => x.includes('unknown unanchored file')), 'synthetic files must surface as scope violations');
    assert.ok(v.totals.runRows === CASES.length * DECLARED_ENGINES.length, 'comparator must see every merged row');
  });

  // --- comparator-side engine-scope contract on a synthetic anchor ------------

  const synthScope = writeSyntheticScope(tmp, 'synth');
  const synthRun = join(tmp, 'synth-run.json');
  writeFileSync(synthRun, JSON.stringify(makeReport('webkit', SYNTH_RUN_CASES)));

  ok('comparator positive: declared webkit run vs synthetic anchor — no missing-result for the other-project anchor row, engine-scoped accounting', () => {
    const { res, verdict } = runCompare(tmp, synthRun, 'synth-verdict.json', synthScope);
    assert.equal(res.status, 0, `comparator should accept the faithful declared-engine run, got ${res.status}: ${res.stderr}`);
    assert.match(res.stdout, /Declared CI engines \(AM-10\): webkit → anchor webkit/);
    const v = JSON.parse(readFileSync(verdict, 'utf8'));
    assert.deepEqual(v.violations, [], 'no violations for a faithful single-engine run');
    assert.equal(v.totals.anchorRows, 3);
    assert.equal(v.totals.requiredAnchorRows, 2, 'engine-scoped required rows = the declared engine mapped anchor-project rows');
    assert.equal(v.outOfEngineScopeAnchorRowCount, 1, 'the chromium anchor row is outside the declared engine mapping');
    assert.equal(v.outOfScopeAnchorRowCount, 0);
    assert.equal(v.expectedRed.length, 1, 'the anchor-failed row red in the run is honest expected red');
    assert.match(v.expectedRed[0], /anchor: failed, Angular: failed/);
  });

  ok('comparator fail-closed: run row with a foreign projectName (chromium, not declared)', () => {
    const foreign = join(tmp, 'foreign-run.json');
    writeFileSync(foreign, JSON.stringify(makeReport('chromium', SYNTH_RUN_CASES)));
    const { res } = runCompare(tmp, foreign, 'foreign-verdict.json', synthScope);
    assert.equal(res.status, 1, `foreign-engine rows must fail the gate, got ${res.status}`);
    assert.match(res.stdout + res.stderr, /not a declared CI engine \(webkit\)/);
  });

  ok('comparator fail-closed: missing declared-engine result for an in-scope anchor row', () => {
    const missing = join(tmp, 'missing-row-run.json');
    writeFileSync(missing, JSON.stringify(makeReport('webkit', SYNTH_RUN_CASES.slice(0, 1))));
    const { res } = runCompare(tmp, missing, 'missing-row-verdict.json', synthScope);
    assert.equal(res.status, 1, 'a missing in-scope anchor row must fail the gate');
    assert.match(res.stdout + res.stderr, /missing result for anchored case.*webkit › alpha\.spec\.ts/);
  });

  ok('comparator fail-closed: declared engine mapped to the WRONG anchor project', () => {
    const wrong = writeSyntheticScope(tmp, 'wrong', { anchorProjectByEngine: { webkit: 'chromium' } });
    const { res } = runCompare(tmp, synthRun, 'wrong-verdict.json', wrong);
    assert.equal(res.status, 1, 'a webkit run mapped against chromium anchor rows must fail closed (no cross-engine substitution verdict)');
    assert.match(res.stdout + res.stderr, /missing result for anchored case.*chromium › alpha\.spec\.ts/);
  });

  ok('fail-closed: absent ciEngines rejected by BOTH the merge and the comparator', () => {
    const noDecl = JSON.parse(readFileSync(synthScope, 'utf8'));
    delete noDecl.ciEngines;
    const noDeclPath = join(tmp, 'nodecl-gate-scope.json');
    writeFileSync(noDeclPath, JSON.stringify(noDecl, null, 2));
    const { res: mergeRes } = runMerge(tmp, DECLARED_ENGINES.map((p) => [p, perProject[p]]), 'nodecl-merged.json', noDeclPath);
    assert.notEqual(mergeRes.status, 0);
    assert.match(mergeRes.stderr, /"ciEngines" is absent or empty/);
    const { res: compareRes } = runCompare(tmp, synthRun, 'nodecl-verdict.json', noDeclPath);
    assert.notEqual(compareRes.status, 0);
    assert.match(compareRes.stderr, /"ciEngines" is absent or empty/);

    const emptyDeclPath = join(tmp, 'emptydecl-gate-scope.json');
    writeFileSync(emptyDeclPath, JSON.stringify({ ...JSON.parse(readFileSync(synthScope, 'utf8')), ciEngines: [] }, null, 2));
    const { res: emptyRes } = runCompare(tmp, synthRun, 'emptydecl-verdict.json', emptyDeclPath);
    assert.notEqual(emptyRes.status, 0);
    assert.match(emptyRes.stderr, /"ciEngines" is absent or empty/);
  });

  ok('comparator fail-closed: zero-row run report', () => {
    const zero = join(tmp, 'zero-run.json');
    writeFileSync(zero, JSON.stringify({ suites: [], errors: [], stats: {} }));
    const { res } = runCompare(tmp, zero, 'zero-verdict.json', synthScope);
    assert.notEqual(res.status, 0);
    assert.match(res.stdout + res.stderr, /zero test rows/);
  });

  ok('anchor validation fail-closed: extra anchor row beyond the declared shape', () => {
    const extraScope = writeSyntheticScope(tmp, 'extra', {});
    const scope = JSON.parse(readFileSync(extraScope, 'utf8'));
    scope.anchor.declaredRows = SYNTH_ANCHOR_ROWS.length + 1;
    writeFileSync(extraScope, JSON.stringify(scope, null, 2));
    const { res } = runCompare(tmp, synthRun, 'extra-verdict.json', extraScope);
    assert.equal(res.status, 1, 'an anchor artifact that does not match its declared shape must fail the gate');
    assert.match(res.stdout + res.stderr, /anchor row count 3 != declared 4/);
  });

  // --- real-data round-trip + comparator verdict identity ---------------------

  const defaultRealReport = resolve(SCRIPT_DIR, 'baseline/react-e2e-baseline-ae42c67-on-java/baseline-report.json');
  const realReport = process.env.MERGE_VALIDATE_REAL_REPORT === 'skip'
    ? undefined
    : process.env.MERGE_VALIDATE_REAL_REPORT ?? (function () { try { readFileSync(defaultRealReport); return defaultRealReport; } catch { return undefined; } })();
  if (realReport) {
    ok(`comparator verdict identity on the REAL report (declared engines: ${DECLARED_ENGINES.join(', ')})`, () => {
      const native = JSON.parse(readFileSync(resolve(realReport), 'utf8'));
      const splits = splitByProject(native, DECLARED_ENGINES);
      const splitPaths = DECLARED_ENGINES.map((p, i) => {
        const f = join(tmp, `real-split-${p}.json`);
        writeFileSync(f, JSON.stringify(splits[i]));
        return [p, f];
      });
      const { res, out } = runMerge(tmp, splitPaths, 'real-merged.json');
      assert.equal(res.status, 0, `merge failed: ${res.stderr}`);
      assert.deepEqual(rowsOf(JSON.parse(readFileSync(out, 'utf8'))), rowsOf(splits[0]), 'merged rows must equal the declared-engine projection rows');
      const runCompareReal = (reportPath, verdictPath) =>
        spawnSync(process.execPath, [COMPARATOR, 'compare', '--gate-scope', GATE_SCOPE, '--json-report', reportPath, '--report', verdictPath], { encoding: 'utf8' });
      const a = runCompareReal(splitPaths[0][1], join(tmp, 'verdict-projection.json'));
      const b = runCompareReal(out, join(tmp, 'verdict-merged.json'));
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
      const projectionVerdict = pick(join(tmp, 'verdict-projection.json'));
      assert.deepEqual(merged.totals, projectionVerdict.totals, 'totals must be identical');
      for (const key of Object.keys(projectionVerdict)) {
        if (key === 'totals' || key === 'anchor' || key === 'gateScope' || key === 'engineCoverage') continue;
        assert.deepEqual(merged[key], projectionVerdict[key], `verdict bucket "${key}" must be identical`);
      }
    });
  } else {
    process.stdout.write(`  skip - real-report comparator verdict identity (set MERGE_VALIDATE_REAL_REPORT=<full parity-run.json> to enable)\n`);
  }

  process.stdout.write(`\n[validate-merge-browser-reports] ${passed.length} validation(s) passed.\n`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
