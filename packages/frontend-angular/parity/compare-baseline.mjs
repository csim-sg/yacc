#!/usr/bin/env node
/**
 * ANG-015 (#385) — parity baseline comparator (PB-2 / CP-4 mechanical gate).
 *
 * Compares a Playwright JSON report of the Angular parity run against the
 * archived React-on-Java anchor (SPEC-003 AD-1, S2 #373) and fails closed:
 *
 *   - the anchor artifact must exist, parse, and match its declared shape
 *     (row count, status counts, unique per-case keys, Tier-1 all green) —
 *     a missing/bad baseline fails the gate, never silently passes it;
 *   - every row that was GREEN in the anchor must be green against Angular —
 *     an anchor-green row that fails on Angular is a REGRESSION (routed back
 *     to the owning port issue #374–#383; never a register entry);
 *   - no test may become skipped/weakened vs the anchor;
 *   - the run scope must match the U10 gate scope (no debug-spec leak, no
 *     silent gate expansion — unknown files are violations);
 *   - anchor-red rows stay permitted red only inside their pre-registered
 *     class (A–E in gate-scope.json); a red row in an unclassified file is a
 *     register gap;
 *   - unanchored rows (U10 promotion + the R1 evidence spec) are fully
 *     surfaced in the report and summary — never silently passed — and are
 *     non-gating until a baseline capture anchors them (register §7).
 *
 * Subcommands:
 *   check   — validate the anchor artifact only (pre-flight, fail closed)
 *   compare — full comparison; exit 1 on any violation; writes a JSON report
 *             and a markdown summary for $GITHUB_STEP_SUMMARY
 *   tsv     — derive an anchor-format per-case TSV from a Playwright JSON
 *             report (used by the React-baseline capture job)
 *
 * Zero dependencies: the anchor TSV is tiny and its format is fixed.
 */
'use strict';

import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const STATUS_FAMILY = {
  passed: 'passed',
  flaky: 'passed', // green after retries — surfaced as a stability warning
  failed: 'red',
  timedOut: 'red',
  interrupted: 'red',
  skipped: 'skipped',
};

const ANCHOR_HEADER = ['project', 'file', 'status', 'retries', 'duration_ms', 'test', 'suite-path'];

function fail(message) {
  process.stderr.write(`[compare-baseline] ${message}\n`);
  process.exit(2);
}

// Repo root, resolved from this script's fixed location
// (packages/frontend-angular/parity/) — gate-scope paths are repo-relative
// and the script must work from any cwd (CI steps, package scripts).
const REPO_ROOT = fileURLToPath(new URL('../../..', import.meta.url));

function repoPath(p) {
  return isAbsolute(p) ? p : resolve(REPO_ROOT, p);
}

function loadGateScope(path) {
  let raw;
  try {
    raw = readFileSync(repoPath(path), 'utf8');
  } catch {
    fail(`gate-scope file not found: ${path} (fail-closed)`);
  }
  let scope;
  try {
    scope = JSON.parse(raw);
  } catch (e) {
    fail(`gate-scope file is not valid JSON: ${path}: ${e.message}`);
  }
  for (const key of ['runMatch', 'excludedDebugSpecs', 'supersededWrappers', 'anchor', 'anchorRedClasses', 'unanchoredKnownFiles']) {
    if (scope[key] === undefined) fail(`gate-scope is missing "${key}" (fail-closed)`);
  }
  return scope;
}

/**
 * Normalize a spec `file` value (as reported by Playwright from either the
 * Angular harness cwd `packages/frontend-angular` or the React harness cwd
 * `packages/frontend`) to the anchor TSV's file-space: relative to
 * `packages/frontend/tests`, with `e2e/tags.e2e.ts` (imported through the
 * superseded wrapper) reported as `e2e/...`.
 */
function normalizeFile(file) {
  if (typeof file !== 'string' || file.length === 0) fail(`run row has empty "file" (fail-closed)`);
  let f = file.replaceAll('\\', '/');
  if (isAbsolute(f)) {
    const marker = 'packages/frontend/';
    const at = f.lastIndexOf(marker);
    if (at >= 0) f = f.slice(at + marker.length);
  }
  for (const prefix of ['../frontend/tests/', 'tests/']) {
    if (f.startsWith(prefix)) return f.slice(prefix.length);
  }
  for (const prefix of ['../frontend/', '../']) {
    if (f.startsWith(prefix)) return f.slice(prefix.length);
  }
  return f;
}

/**
 * The TSV suite-path column is "<file-name> > <describe chain>" — but the
 * leading file name is NOT stable across the wrapper/direct discovery
 * difference (the anchor recorded `tags.e2e.spec.ts > …` for rows whose file
 * column says `../e2e/tags.e2e.ts`). Matching therefore uses the describe
 * chain only, with the leading file segment stripped from both sides.
 */
function suiteChain(suitePath) {
  const at = suitePath.indexOf(' > ');
  return at >= 0 ? suitePath.slice(at + 3) : '';
}

function rowKey(project, file, suitePath, test) {
  return `${project}|${file}|${suiteChain(suitePath)}|${test}`;
}

function parseAnchorTsv(path) {
  let raw;
  try {
    raw = readFileSync(repoPath(path), 'utf8');
  } catch {
    fail(`anchor per-case listing not found: ${path} (fail-closed — capture the baseline first)`);
  }
  const lines = raw.split('\n').filter((l, i, arr) => l.length > 0 || i < arr.length - 1);
  if (lines.length === 0) fail(`anchor TSV is empty: ${path} (fail-closed)`);
  const header = lines[0].split('\t');
  if (header.length !== ANCHOR_HEADER.length || header.some((h, i) => h !== ANCHOR_HEADER[i])) {
    fail(`anchor TSV header mismatch: expected [${ANCHOR_HEADER.join(', ')}], got [${header.join(', ')}] (fail-closed)`);
  }
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '') continue;
    const cols = line.split('\t');
    if (cols.length !== ANCHOR_HEADER.length) {
      fail(`anchor TSV row ${i + 1} has ${cols.length} columns, expected ${ANCHOR_HEADER.length} (fail-closed)`);
    }
    const [project, file, status, retries, duration, test, suitePath] = cols;
    if (!(status in STATUS_FAMILY)) fail(`anchor TSV row ${i + 1} has unknown status "${status}" (fail-closed)`);
    rows.push({
      project,
      file: normalizeFile(file),
      status,
      retries: Number.parseInt(retries, 10) || 0,
      durationMs: Number.parseInt(duration, 10) || 0,
      test,
      suitePath,
    });
  }
  return rows;
}

function validateAnchor(anchorRows, scope) {
  const violations = [];
  const declared = scope.anchor;
  if (anchorRows.length !== declared.declaredRows) {
    violations.push(`anchor row count ${anchorRows.length} != declared ${declared.declaredRows} — the artifact does not match its recorded shape (fail-closed)`);
  }
  const counts = { passed: 0, failed: 0, timedOut: 0, skipped: 0, flaky: 0 };
  const seen = new Set();
  const files = new Map(); // normalized file -> { red: n, passed: n, skipped: n }
  for (const row of anchorRows) {
    counts[row.status] += 1;
    const key = rowKey(row.project, row.file, row.suitePath, row.test);
    if (seen.has(key)) violations.push(`duplicate anchor row key: ${key}`);
    seen.add(key);
    if (!declared.projects.includes(row.project)) {
      violations.push(`anchor row has unexpected project "${row.project}" (declared: ${declared.projects.join(', ')})`);
    }
    const byFile = files.get(row.file) ?? { red: 0, passed: 0, skipped: 0 };
    if (STATUS_FAMILY[row.status] === 'red') byFile.red += 1;
    else if (row.status === 'passed') byFile.passed += 1;
    else if (row.status === 'skipped') byFile.skipped += 1;
    files.set(row.file, byFile);
  }
  for (const status of ['passed', 'failed', 'timedOut', 'skipped', 'flaky']) {
    if (counts[status] !== declared.declaredCounts[status]) {
      violations.push(`anchor ${status} count ${counts[status]} != declared ${declared.declaredCounts[status]} (fail-closed)`);
    }
  }
  // Tier-1 API specs stay green unconditionally (they test the backend).
  for (const tier1 of declared.tier1AllGreen) {
    const byFile = files.get(tier1);
    if (!byFile) violations.push(`Tier-1 file "${tier1}" absent from the anchor (fail-closed)`);
    else if (byFile.red > 0 || byFile.passed === 0) {
      violations.push(`Tier-1 file "${tier1}" is not all-green in the anchor — a red Tier-1 row invalidates the anchor (fail-closed)`);
    }
  }
  // Every in-scope file with anchor-red rows must carry a pre-registered class.
  const classified = new Set(
    Object.values(scope.anchorRedClasses)
      .filter((c) => Array.isArray(c.files))
      .flatMap((c) => c.files),
  );
  for (const [file, byFile] of files) {
    if (byFile.red > 0 && !classified.has(file) && !isExcluded(scope, file)) {
      violations.push(`anchor-red file "${file}" has no pre-registered class in gate-scope.json anchorRedClasses (register gap — classify it or update the register deliberately)`);
    }
  }
  for (const [className, def] of Object.entries(scope.anchorRedClasses)) {
    if (!def || !Array.isArray(def.files)) continue; // skips the $comment key
    for (const file of def.files) {
      const byFile = files.get(file);
      if (!byFile || byFile.red === 0) {
        violations.push(`class ${className} lists "${file}" but the anchor has no red rows for it — update gate-scope.json/register deliberately`);
      }
    }
  }
  return violations;
}

function isExcluded(scope, normalizedFile) {
  for (const entry of [...scope.excludedDebugSpecs, ...scope.supersededWrappers]) {
    if (normalizeFile(entry) === normalizedFile) return true;
  }
  return false;
}

function collectSpecs(suite, path, out) {
  if (!suite) return;
  const current = path.concat(suite.title ?? []);
  for (const spec of suite.specs ?? []) out.push({ suiteTitles: current, spec });
  for (const child of suite.suites ?? []) collectSpecs(child, current, out);
}

function parseRunJson(path) {
  let raw;
  try {
    raw = readFileSync(repoPath(path), 'utf8');
  } catch {
    fail(`Playwright JSON report not found: ${path} (fail-closed — the parity run must produce a report)`);
  }
  let report;
  try {
    report = JSON.parse(raw);
  } catch (e) {
    fail(`Playwright JSON report is not valid JSON: ${path}: ${e.message} (fail-closed)`);
  }
  if (!report || !Array.isArray(report.suites)) {
    fail(`Playwright JSON report has no "suites" array: ${path} (fail-closed)`);
  }
  const rows = [];
  const specs = [];
  for (const top of report.suites) collectSpecs(top, [], specs);
  for (const { suiteTitles, spec } of specs) {
    for (const test of spec.tests ?? []) {
      const file = normalizeFile(spec.file);
      const describeTitles = suiteTitles.filter((t) => t && t !== spec.file);
      const suitePath = [file, ...describeTitles].join(' > ');
      const results = test.results ?? [];
      rows.push({
        project: test.projectName,
        file,
        status: test.status,
        retries: Math.max(0, results.length - 1),
        durationMs: results.reduce((sum, r) => sum + (r.duration ?? 0), 0),
        test: spec.title,
        suitePath,
      });
    }
  }
  if (rows.length === 0) fail(`Playwright JSON report contains zero test rows: ${path} (fail-closed)`);
  return rows;
}

function topTitle(spec) {
  // Playwright puts the file name as the root suite title; handled via spec.file above.
  return spec.file;
}

function compare(anchorRows, runRows, scope) {
  const violations = [];
  const regressions = [];
  const weakenings = [];
  const expectedRed = [];
  const improvements = [];
  const unanchoredRed = [];
  const unanchoredGreen = [];
  const skippedSurface = [];
  const stabilityWarnings = [];
  const outOfScopeAnchorRows = [];

  const anchorByKey = new Map();
  for (const row of anchorRows) {
    anchorByKey.set(rowKey(row.project, row.file, row.suitePath, row.test), row);
  }
  const anchorFiles = new Set(anchorRows.map((r) => r.file));
  const runFiles = new Set(runRows.map((r) => r.file));
  const promotedFiles = new Set(scope.unanchoredKnownFiles['e2e-promotion'].map(normalizeFile));
  const nativeTier0Files = new Set(scope.unanchoredKnownFiles['angular-native-tier0'].map(normalizeFile));
  const unanchoredAllowed = new Set([...promotedFiles, ...nativeTier0Files]);
  const inScopeAnchorFiles = [...anchorFiles].filter((f) => !isExcluded(scope, f));

  // Run-side scope integrity.
  for (const file of [...runFiles].sort()) {
    if (isExcluded(scope, file)) {
      violations.push(`scope leak: excluded spec ran in the parity gate: ${file}`);
    } else if (!anchorFiles.has(file) && !unanchoredAllowed.has(file)) {
      violations.push(`unknown unanchored file in the gate run: ${file} — new gating-scope rows must be registered/anchored deliberately (PB-2, no silent expansion)`);
    }
  }

  // Row-level comparison.
  const runKeys = new Set();
  for (const row of runRows) {
    const key = rowKey(row.project, row.file, row.suitePath, row.test);
    runKeys.add(key);
    const anchor = anchorByKey.get(key);
    const label = `${row.project} › ${row.file} › ${row.suitePath} › ${row.test}`;
    const runFamily = STATUS_FAMILY[row.status];
    if (isExcluded(scope, row.file)) continue;
    if (!anchor) {
      if (nativeTier0Files.has(row.file)) {
        // Angular-native Tier-0 evidence specs are their own anchor: their
        // expected status is green, so red is a live Angular regression.
        if (runFamily === 'red') {
          violations.push(`Angular-native Tier-0 evidence row red (regression on the Angular surface; route to the owning issue): ${label}`);
        } else if (runFamily === 'skipped') {
          weakenings.push(`${label} — Angular-native Tier-0 evidence row skipped`);
        } else {
          unanchoredGreen.push(label);
        }
      } else if (runFamily === 'red') {
        unanchoredRed.push(label);
      } else {
        unanchoredGreen.push(label);
      }
      continue;
    }
    const anchorFamily = STATUS_FAMILY[anchor.status];
    if (anchorFamily === 'passed') {
      if (runFamily === 'passed') {
        if (row.status === 'flaky') stabilityWarnings.push(label);
      } else if (runFamily === 'red') {
        regressions.push(`${label} — anchor: ${anchor.status}, Angular: ${row.status}`);
      } else if (runFamily === 'skipped') {
        weakenings.push(`${label} — anchor-green row is now skipped`);
      }
    } else if (anchorFamily === 'red') {
      if (runFamily === 'red') {
        expectedRed.push(`${label} — anchor: ${anchor.status}, Angular: ${row.status}`);
      } else if (runFamily === 'passed') {
        improvements.push(`${label} — anchor ${anchor.status} now passes`);
      } else if (runFamily === 'skipped') {
        weakenings.push(`${label} — anchor-red row is now skipped (weakened, not fixed)`);
      }
    } else if (anchorFamily === 'skipped') {
      skippedSurface.push(`${label} — anchor skipped, Angular: ${row.status}`);
    }
  }

  // Fail-closed: every in-scope anchor row must have a result in the run.
  for (const row of anchorRows) {
    if (isExcluded(scope, row.file)) {
      outOfScopeAnchorRows.push(row);
      continue;
    }
    const key = rowKey(row.project, row.file, row.suitePath, row.test);
    if (!runKeys.has(key)) {
      violations.push(`missing result for anchored case (silent shrinkage or crashed run): ${row.project} › ${row.file} › ${row.suitePath} › ${row.test}`);
    }
  }

  // Register-gap detection for red rows in files without a class is done at
  // anchor-validation time; red rows in unclassified NON-anchor files were
  // already caught as "unknown unanchored file".

  return {
    violations,
    regressions,
    weakenings,
    expectedRed,
    improvements,
    unanchoredRed,
    unanchoredGreen,
    skippedSurface,
    stabilityWarnings,
    outOfScopeAnchorRowCount: outOfScopeAnchorRows.length,
    totals: {
      anchorRows: anchorRows.length,
      runRows: runRows.length,
      inScopeAnchorFiles: inScopeAnchorFiles.length,
    },
  };
}

function renderMarkdown(result) {
  const lines = [];
  lines.push('## Angular parity gate — baseline comparison (PB-2)');
  lines.push('');
  lines.push(`Anchor rows: ${result.totals.anchorRows} · Run rows: ${result.totals.runRows} · Out-of-scope anchor rows (U10-excluded): ${result.outOfScopeAnchorRowCount}`);
  lines.push('');
  const section = (title, items, cap) => {
    lines.push(`### ${title} (${items.length})`);
    if (items.length === 0) lines.push('_none_');
    for (const item of items.slice(0, cap)) lines.push(`- ${item}`);
    if (items.length > cap) lines.push(`- … and ${items.length - cap} more (see the comparison-report artifact)`);
    lines.push('');
  };
  section('VIOLATIONS — gate-blocking', result.violations, 50);
  section('REGRESSIONS — anchor-green rows red on Angular (route to the owning port issue; never a register entry)', result.regressions, 100);
  section('WEAKENINGS — rows skipped vs anchor', result.weakenings, 50);
  section('Unanchored RED — surfaced, non-gating until anchored (register §7)', result.unanchoredRed, 100);
  lines.push(`Expected-red rows still red (pre-registered classes A–E): **${result.expectedRed.length}** (full list in the artifact)`);
  lines.push('');
  section('Improvements — anchor-red rows now green (retire register entries at the next anchor)', result.improvements, 30);
  section('Stability warnings — green only after retries (flaky)', result.stabilityWarnings, 30);
  section('Anchor-skipped rows surfaced', result.skippedSurface, 20);
  lines.push(`Unanchored green rows (surfaced, non-gating): ${result.unanchoredGreen.length}`);
  lines.push('');
  return lines.join('\n');
}

function verifyAnchorHashes(scope) {
  const violations = [];
  const declared = scope.anchor.sha256 ?? {};
  if (Object.keys(declared).length === 0) {
    violations.push('gate-scope.anchor.sha256 is empty — anchor provenance hashes are mandatory (fail-closed)');
  }
  for (const [name, expected] of Object.entries(declared)) {
    const path = resolve(repoPath(scope.anchor.perCaseListing), '..', name);
    let actual;
    try {
      actual = createHash('sha256').update(readFileSync(repoPath(path))).digest('hex');
    } catch {
      violations.push(`anchor artifact "${name}" declared in gate-scope but missing at ${path} (fail-closed)`);
      continue;
    }
    if (actual !== expected) {
      violations.push(`anchor artifact "${name}" SHA-256 mismatch — declared ${expected.slice(0, 12)}…, actual ${actual.slice(0, 12)}… (the artifact changed without a deliberate register/gate-scope update; fail-closed)`);
    }
  }
  return violations;
}

function cmdCheck(scope) {
  const anchorRows = parseAnchorTsv(scope.anchor.perCaseListing);
  const violations = [...validateAnchor(anchorRows, scope), ...verifyAnchorHashes(scope)];
  if (violations.length > 0) {
    process.stderr.write('[compare-baseline] ANCHOR INVALID (fail-closed):\n');
    for (const v of violations) process.stderr.write(`  - ${v}\n`);
    process.exit(1);
  }
  process.stdout.write(`[compare-baseline] anchor OK: ${anchorRows.length} rows, SHA-verified location ${scope.anchor.perCaseListing}\n`);
}

function cmdCompare(args, scope) {
  const anchorRows = parseAnchorTsv(scope.anchor.perCaseListing);
  const anchorViolations = validateAnchor(anchorRows, scope);
  const runRows = parseRunJson(args['--json-report']);
  const result = compare(anchorRows, runRows, scope);
  result.violations.unshift(...anchorViolations);
  const report = { gateScope: scope.decision, anchor: scope.anchor.id, generatedAt: new Date().toISOString(), ...result };
  if (args['--report']) {
    writeFileSync(args['--report'], JSON.stringify(report, null, 2) + '\n');
  }
  process.stdout.write(renderMarkdown(result));
  const blocking = result.violations.length + result.regressions.length + result.weakenings.length;
  if (blocking > 0) {
    process.stderr.write(`\n[compare-baseline] PARITY GATE RED: ${result.violations.length} violation(s), ${result.regressions.length} regression(s), ${result.weakenings.length} weakening(s)\n`);
    process.exit(1);
  }
  process.stdout.write('\n[compare-baseline] PARITY GATE GREEN — zero regressions vs the anchored baseline (unanchored rows surfaced, non-gating)\n');
}

function cmdTsv(args) {
  const runRows = parseRunJson(args['--json-report']);
  const header = ANCHOR_HEADER.join('\t');
  const body = runRows.map((r) => [r.project, r.file, r.status, r.retries, r.durationMs, r.test, r.suitePath].join('\t'));
  writeFileSync(args['--out'], [header, ...body].join('\n') + '\n');
  process.stdout.write(`[compare-baseline] wrote ${runRows.length} rows to ${args['--out']}\n`);
}

function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const args = {};
  for (let i = 0; i < rest.length; i += 2) {
    if (!rest[i].startsWith('--')) fail(`unexpected argument: ${rest[i]}`);
    args[rest[i]] = rest[i + 1];
  }
  if (cmd !== 'check' && cmd !== 'compare' && cmd !== 'tsv') {
    fail('usage: compare-baseline.mjs <check|compare|tsv> [--gate-scope parity/gate-scope.json] [--json-report report.json] [--report out.json] [--out out.tsv]');
  }
  if (cmd === 'tsv') {
    if (!args['--json-report'] || !args['--out']) fail('tsv requires --json-report and --out');
    cmdTsv(args);
    return;
  }
  const scopePath = args['--gate-scope'] ?? fileURLToPath(new URL('./gate-scope.json', import.meta.url));
  const scope = loadGateScope(scopePath);
  if (cmd === 'check') {
    cmdCheck(scope);
  } else {
    if (!args['--json-report']) fail('compare requires --json-report');
    cmdCompare(args, scope);
  }
}

main();
