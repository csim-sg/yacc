#!/usr/bin/env node
/**
 * ANG-015 (#385) — per-browser parity report aggregation (PB-2, fail-closed).
 *
 * Merges the per-browser Playwright JSON reports produced by the `parity`
 * matrix jobs (chromium / firefox / webkit — one FULL U10-suite run each) into
 * the single 3-browser report the unchanged comparator
 * (`compare-baseline.mjs compare`) consumes as the PB-2 gate decision.
 *
 * The merge is a lossless structural concatenation: a Playwright JSON report's
 * top-level `suites` array is per-file, and in a `--project=<browser>` run each
 * spec entry carries exactly one test (that project's). Concatenating the
 * per-browser `suites` arrays therefore reproduces the exact row set of a
 * native 3-browser run — every row (project | file | describe chain | test,
 * with its full results array) passes through byte-identically. The comparator
 * walks `report.suites` row-by-row and makes no suite-uniqueness assumption,
 * so the merged report is consumed exactly like a native one.
 *
 * Fails closed (exit 2) before writing anything when:
 *   - the gate scope's declared anchor browser projects (`anchor.projects`)
 *     are not covered by exactly one `--project <name>=<path>` each (no
 *     missing browser, no undeclared extra, no duplicates);
 *   - a report is absent, unparsable, has no `suites` array, or contains zero
 *     rows (a killed/crashed browser run must never yield a partial verdict);
 *   - any row in a report belongs to a project other than the report's own
 *     designated browser (mis-scoped run);
 *   - a report contains a duplicate row key (ambiguous evidence);
 *   - the per-browser CASE sets (file | describe chain | test — project-free)
 *     are not identical across all browsers (every browser must have run the
 *     full suite; a shortened/timeout-truncated run fails here, and the
 *     comparator's own fail-closed "missing result for anchored case" check
 *     still applies on top).
 *
 * The output adds a `merge` provenance block (per-source path, SHA-256, row
 * count) and sums the input `stats`; `suites`, `errors` and every result row
 * are carried through unchanged. Gate semantics remain entirely in
 * `compare-baseline.mjs` — this script only assembles complete evidence.
 *
 * Validation: `parity/validate-merge-browser-reports.mjs` (synthetic fixtures,
 * failure paths, round-trip identity) — run it after any change here.
 *
 * Zero dependencies, same conventions as compare-baseline.mjs.
 */
'use strict';

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function fail(message) {
  process.stderr.write(`[merge-browser-reports] ${message}\n`);
  process.exit(2);
}

// Repo root, resolved from this script's fixed location
// (packages/frontend-angular/parity/) — gate-scope paths are repo-relative.
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
  if (!scope || !Array.isArray(scope.anchor?.projects) || scope.anchor.projects.length === 0) {
    fail(`gate-scope is missing a non-empty "anchor.projects" array: ${path} (fail-closed)`);
  }
  return scope;
}

// --- Row collection: mirrors compare-baseline.mjs exactly -------------------
// The comparator (compare-baseline.mjs) derives each row's identity as
// `project | normalizeFile(file) | suiteChain(suitePath) | test`. The helpers
// below are kept semantically identical to it so validation here judges the
// same identities the gate decision will use. validate-merge-browser-reports.mjs
// guards this agreement with a real-report round-trip through the comparator.

/**
 * Normalize a spec `file` value to the anchor TSV's file-space — verbatim from
 * compare-baseline.mjs (keep in sync; drift is caught by the validator's
 * comparator round-trip).
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

/** The describe chain only (leading file segment stripped) — as the comparator. */
function suiteChain(suitePath) {
  const at = suitePath.indexOf(' > ');
  return at >= 0 ? suitePath.slice(at + 3) : '';
}

function rowKey(project, file, suitePath, test) {
  return `${project}|${file}|${suiteChain(suitePath)}|${test}`;
}

function collectSpecs(suite, path, out) {
  if (!suite) return;
  const current = path.concat(suite.title ?? []);
  for (const spec of suite.specs ?? []) out.push({ suiteTitles: current, spec });
  for (const child of suite.suites ?? []) collectSpecs(child, current, out);
}

/** Collector over a parsed report: rows with comparator-identical identities. */
function collectRows(report, label) {
  if (!report || !Array.isArray(report.suites)) {
    fail(`${label}: report has no "suites" array (fail-closed)`);
  }
  const specs = [];
  for (const top of report.suites) collectSpecs(top, [], specs);
  const rows = [];
  for (const { suiteTitles, spec } of specs) {
    for (const test of spec.tests ?? []) {
      const file = normalizeFile(spec.file);
      const describeTitles = suiteTitles.filter((t) => t && t !== spec.file);
      const suitePath = [file, ...describeTitles].join(' > ');
      rows.push({
        project: test.projectName,
        file,
        suitePath,
        test: spec.title,
      });
    }
  }
  return rows;
}

function sha256File(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

// --- CLI ---------------------------------------------------------------------

function parseArgs(argv) {
  const args = { projects: [] };
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag === '--project') {
      const at = String(value ?? '').indexOf('=');
      if (at <= 0) fail(`--project expects <name>=<path>, got: ${value}`);
      args.projects.push({ name: value.slice(0, at), path: value.slice(at + 1) });
    } else if (flag === '--out' || flag === '--gate-scope') {
      args[flag] = value;
    } else {
      fail(`unexpected argument: ${flag} (usage: merge-browser-reports.mjs --project <name>=<report.json> [...] --out <merged.json> [--gate-scope parity/gate-scope.json])`);
    }
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args['--out']) fail('--out <merged.json> is required');
  const scope = loadGateScope(args['--gate-scope'] ?? fileURLToPath(new URL('./gate-scope.json', import.meta.url)));
  const expected = scope.anchor.projects;

  // 1. The --project set must equal the declared anchor projects exactly.
  const given = new Map();
  for (const { name, path } of args.projects) {
    if (given.has(name)) fail(`duplicate --project entry for "${name}" (fail-closed)`);
    given.set(name, path);
  }
  const missing = expected.filter((p) => !given.has(p));
  const extra = [...given.keys()].filter((p) => !expected.includes(p));
  if (missing.length > 0) {
    fail(`missing per-browser report(s) for declared project(s): ${missing.join(', ')} — the aggregated parity gate fails closed on any absent browser (declared: ${expected.join(', ')})`);
  }
  if (extra.length > 0) {
    fail(`undeclared --project entries (not in gate-scope.anchor.projects): ${extra.join(', ')} — declared: ${expected.join(', ')}`);
  }

  // 2. Load + structurally validate each per-browser report.
  const loaded = [];
  for (const project of expected) {
    const path = given.get(project);
    let report;
    try {
      report = JSON.parse(readFileSync(repoPath(path), 'utf8'));
    } catch (e) {
      fail(`per-browser report for "${project}" is absent or not valid JSON: ${path}: ${e.message} (fail-closed)`);
    }
    const rows = collectRows(report, `report "${project}"`);
    if (rows.length === 0) {
      fail(`per-browser report for "${project}" contains zero test rows: ${path} (a killed/crashed run must never yield a partial verdict — fail-closed)`);
    }
    for (const row of rows) {
      if (row.project !== project) {
        fail(`report "${project}" contains a row for project "${row.project}" (${row.file} › ${row.test}) — mis-scoped run (fail-closed)`);
      }
    }
    const seen = new Set();
    for (const row of rows) {
      const key = rowKey(row.project, row.file, row.suitePath, row.test);
      if (seen.has(key)) {
        fail(`report "${project}" contains a duplicate row: ${key} (ambiguous evidence — fail-closed)`);
      }
      seen.add(key);
    }
    loaded.push({ project, path, report, rows });
  }

  // 3. Exact case coverage: every browser must present the identical case set
  //    (file | describe chain | test — project-free). A browser job that ran
  //    less than the full suite fails here, before any gate verdict exists.
  const caseKey = (row) => `${row.file}|${suiteChain(row.suitePath)}|${row.test}`;
  const caseSets = loaded.map(({ project, rows }) => ({ project, set: new Set(rows.map(caseKey)) }));
  const reference = caseSets[0];
  for (const other of caseSets.slice(1)) {
    const onlyInRef = [...reference.set].filter((k) => !other.set.has(k));
    const onlyInOther = [...other.set].filter((k) => !reference.set.has(k));
    if (onlyInRef.length > 0 || onlyInOther.length > 0) {
      const show = (list) => list.slice(0, 10).map((k) => `      ${k.replaceAll('|', ' › ')}`).join('\n');
      fail(`per-browser case sets differ between "${reference.project}" and "${other.project}" — every browser must run the identical full suite (fail-closed):\n` +
        (onlyInRef.length ? `    only in ${reference.project} (${onlyInRef.length}):\n${show(onlyInRef)}\n` : '') +
        (onlyInOther.length ? `    only in ${other.project} (${onlyInOther.length}):\n${show(onlyInOther)}` : ''));
    }
  }

  // 4. Lossless merge: suites concatenated in the declared project order;
  //    every result row (incl. full results arrays) passes through untouched.
  const suites = [];
  let totalRows = 0;
  const sources = [];
  const errors = [];
  const stats = { expected: 0, unexpected: 0, flaky: 0, skipped: 0, duration: 0, startTime: undefined };
  for (const { project, path, report, rows } of loaded) {
    suites.push(...report.suites);
    errors.push(...(report.errors ?? []));
    totalRows += rows.length;
    if (report.stats && typeof report.stats === 'object') {
      for (const key of ['expected', 'unexpected', 'flaky', 'skipped']) {
        stats[key] += typeof report.stats[key] === 'number' ? report.stats[key] : 0;
      }
      stats.duration += typeof report.stats.duration === 'number' ? report.stats.duration : 0;
      const started = Date.parse(report.stats.startTime);
      if (!Number.isNaN(started) && (stats.startTime === undefined || started < stats.startTime)) {
        stats.startTime = new Date(started).toISOString();
      }
    }
    sources.push({
      project,
      path,
      sha256: sha256File(repoPath(path)),
      rows: rows.length,
      cases: caseSets.find((c) => c.project === project).set.size,
    });
  }

  const merged = {
    suites,
    errors,
    stats: {
      ...stats,
      startTime: stats.startTime ?? undefined,
    },
    merge: {
      tool: 'parity/merge-browser-reports.mjs',
      mergedAt: new Date().toISOString(),
      gateScope: scope.decision,
      anchor: scope.anchor.id,
      shape: 'concatenated per-browser Playwright JSON suites (lossless; consumed by compare-baseline.mjs like a native multi-project report)',
      sources,
      totalRows,
    },
  };

  const outPath = repoPath(args['--out']);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(merged, null, 2) + '\n');

  process.stdout.write(
    `[merge-browser-reports] merged ${totalRows} rows ` +
    `(cases: ${sources[0].cases} × ${sources.length} browsers: ${expected.join(', ')}) -> ${args['--out']}\n` +
    sources.map((s) => `  ${s.project}: ${s.rows} rows, sha256 ${s.sha256.slice(0, 12)}… (${s.path})`).join('\n') +
    `\n[merge-browser-reports] coverage validated: identical case set across all browsers (fail-closed aggregation OK).\n`,
  );
}

main();
