#!/usr/bin/env node
/**
 * ANG-015-P1b (#481) — declared-adaptation integrity gate for the frozen suite.
 *
 * SPEC-003 PB-2 discipline: suite files under `packages/frontend/tests` and
 * `packages/frontend/e2e` are never edited silently. The pre-#481 gate failed
 * closed on ANY modified/renamed/deleted (MRD) suite file, which left no lawful
 * route for a reviewed, backend-decided re-point (#480, #495). This gate keeps
 * the fail-closed default and adds exactly one reviewable route: a declaration
 * in `parity/suite-adaptations.json`.
 *
 * Modes (default = manifest + MRD + guard, i.e. everything):
 *
 *   (default)        Fail closed when
 *                      (a) an MRD-changed suite file has no declaration,
 *                      (b) a declared file/case no longer exists at HEAD,
 *                      (c) the manifest is missing, unparsable, or a required
 *                          field is absent/invalid (checked ALWAYS, not only
 *                          when suite files change), and
 *                      (d) the PB-2 PR-matrix deferral guard is inconsistent
 *                          (see --guard).
 *                    `--base <sha>` supplies the PR merge base for the MRD diff
 *                    (`<base>...HEAD`, the exact semantics of the pre-#481
 *                    gate). Without `--base` the MRD cross-check is skipped
 *                    with a loud note (use --manifest-only instead when that
 *                    is the intent).
 *                    Per-case authorization (loop-1 review correction): for a
 *                    MODIFIED declared file, changed `-U0` hunks are
 *                    attributed to case bodies on both sides of the diff
 *                    (additions/modifications vs HEAD regions, pure deletions
 *                    vs BASE regions) and every touched case must be declared
 *                    — a declaration never authorizes edits to other cases in
 *                    the same file. Hunks outside every case body
 *                    (describe-level hooks, file-local helpers, imports,
 *                    file-level code) cannot be attributed and fail closed.
 *                    Renames/deletes keep the file-level checks (they can
 *                    never satisfy a declaration).
 *   --manifest-only  Manifest schema + declared-entry existence only (no git
 *                    diff, no workflow guard).
 *   --guard          PB-2 PR-matrix deferral-guard consistency only: the
 *                    `PB2-PR-MATRIX: SUSPENDED|ACTIVE` sentinel in
 *                    `.github/workflows/frontend-angular-parity.yml` must agree
 *                    with the actual matrix conditions and the deferral marker.
 *                    This is the self-reverting guard for the interim AM-1
 *                    suspension (#481): re-enabling the matrix without removing
 *                    the deferral marker — or vice versa — fails preflight.
 *                    Restoration (#490) must do both in the SAME change.
 *
 * Flags: --manifest <path>  (default packages/frontend-angular/parity/suite-adaptations.json)
 *        --repo <dir>       (default: this script's repo root)
 *        --workflow <path>  (default .github/workflows/frontend-angular-parity.yml)
 *
 * Declaration schema (parity/suite-adaptations.json — an array, possibly empty):
 *   [{ "issue": "#480",                  // ^#\d+$
 *      "date": "2026-11-12",             // YYYY-MM-DD
 *      "file": "packages/frontend/tests/x.spec.ts",   // under a protected prefix
 *      "cases": ["<exact FULL case title as `npx playwright test --list` prints it>"],
 *      "kind": "contract-conformance" | "founder-decision" | "fixture-fragility",
 *      "rationale": "<one sentence>",
 *      "approval": "<https:// review-decision URL>" }]
 *
 * A declaration is per exact case title, never a file glob: a declared file
 * whose declared titles no longer exist authorises nothing, and only edits
 * INSIDE the declared cases' bodies are authorised — changed hunks are
 * attributed to case regions (both diff sides) and any other changed case, or
 * any hunk outside all case bodies, fails closed. The manifest never
 * authorises assertion weakening — the reviewer still verifies
 * equivalent-or-stronger; expected-red/anchor semantics are unchanged.
 *
 * Zero dependencies. Exit 0 = pass; any violation exits 1 with an actionable
 * `::error::` message naming the offending file/case and the manifest path.
 */
'use strict';

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '..', '..', '..');

const PROTECTED_PREFIXES = ['packages/frontend/tests/', 'packages/frontend/e2e/'];
const MANIFEST_REL = 'packages/frontend-angular/parity/suite-adaptations.json';
const WORKFLOW_REL = '.github/workflows/frontend-angular-parity.yml';
const ADAPTATION_KINDS = ['contract-conformance', 'founder-decision', 'fixture-fragility'];
const REQUIRED_ENTRY_KEYS = ['issue', 'date', 'file', 'cases', 'kind', 'rationale', 'approval'];
const DEFERRAL_LINE = 'PB-2 PR verdict deferred to AM-1/#490 — no verdict claimed';
const DEFERRAL_JOB = 'pb2-pr-deferral';

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function err() {
  for (const line of arguments) process.stderr.write(`${line}\n`);
}

function die(messages) {
  for (const m of messages) {
    const lines = m.split('\n');
    err(`::error::${lines[0]}`);
    for (const l of lines.slice(1)) err(l);
  }
  process.exit(1);
}

function parseArgs(argv) {
  const args = {
    manifest: null, repo: null, workflow: null, base: null,
    manifestOnly: false, guard: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--manifest') args.manifest = argv[++i];
    else if (a === '--repo') args.repo = argv[++i];
    else if (a === '--workflow') args.workflow = argv[++i];
    else if (a === '--base') args.base = argv[++i];
    else if (a === '--manifest-only') args.manifestOnly = true;
    else if (a === '--guard') args.guard = true;
    else die([`Unknown argument '${a}' (see the header of check-suite-adaptations.mjs).`]);
  }
  const repo = args.repo ? resolve(args.repo) : REPO_ROOT;
  args.repo = repo;
  args.manifest = resolve(repo, args.manifest || MANIFEST_REL);
  args.workflow = resolve(repo, args.workflow || WORKFLOW_REL);
  return args;
}

// ---------------------------------------------------------------------------
// Case-title extraction (full Playwright titles: describe prefix + test title)
// ---------------------------------------------------------------------------

const DESCRIBE_RE = /\btest\.describe(?:\.\w+)?\(\s*(?:'([^']*)'|"([^"]*)")/;
const TEST_RE = /\btest(?:\.\w+)?\(\s*(?:'([^']*)'|"([^"]*)")/;

/**
 * Extract every case's FULL title (describe stack joined with a single space +
 * test title) together with its 1-based inclusive body line range — the exact
 * form `npx playwright test --list` prints. Plain quoted literals only: an
 * exotic title form is not extractable and therefore can never be satisfied by
 * a declaration, which is the fail-closed direction (a stale-looking
 * declaration forces a human look).
 *
 * The body range is the test callback's brace block: it starts on the `test(`
 * line and ends when the brace depth returns to the depth the line started at.
 * Lines outside any case body (describe-level hooks, helpers, imports,
 * file-level code) are intentionally NOT covered by any region — the gate
 * fails closed when a changed hunk cannot be attributed to a declared case.
 */
export function extractCaseRegions(sourceText) {
  const regions = [];
  const regionStack = []; // { title, depthBefore, startLine } — describes AND tests
  let depth = 0;
  const lines = sourceText.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const describeMatch = line.match(DESCRIBE_RE);
    const testMatch = TEST_RE.test(line) && !/test\.describe/.test(line) ? line.match(TEST_RE) : null;
    if (describeMatch) {
      regionStack.push({ title: describeMatch[1] ?? describeMatch[2], depthBefore: depth, startLine: i + 1, isTest: false });
    } else if (testMatch) {
      const title = regionStack.map((d) => d.title).concat([testMatch[1] ?? testMatch[2]]).join(' ');
      regionStack.push({ title, depthBefore: depth, startLine: i + 1, isTest: true });
    }
    for (const ch of line) {
      if (ch === '{') depth += 1;
      else if (ch === '}') depth -= 1;
    }
    // Pop only AFTER the whole line: balanced braces on a region's own opening
    // line (e.g. the `({ page })` destructuring before the callback's `{`) must
    // not close the region it just opened; a region closes when a LATER line
    // (its `});`) returns the depth to the level the opening line started at.
    while (regionStack.length && regionStack[regionStack.length - 1].depthBefore >= depth) {
      const done = regionStack.pop();
      if (done.isTest) regions.push({ title: done.title, start: done.startLine, end: i + 1 });
    }
  }
  return regions;
}

export function extractFullTitles(sourceText) {
  return extractCaseRegions(sourceText).map((r) => r.title);
}

function titlesInFile(absPath) {
  if (!existsSync(absPath)) return null;
  return extractFullTitles(readFileSync(absPath, 'utf8'));
}

// ---------------------------------------------------------------------------
// Manifest validation
// ---------------------------------------------------------------------------

function validateManifestText(text, manifestPath) {
  const errors = [];
  let entries;
  try {
    entries = JSON.parse(text);
  } catch (e) {
    return { errors: [`Manifest ${manifestPath} is not parsable JSON (${e.message}) — fail closed (fix or revert the manifest; no silent fallback).`], entries: [] };
  }
  if (!Array.isArray(entries)) {
    return { errors: [`Manifest ${manifestPath} must be a JSON array of declarations (found ${typeof entries}) — fail closed.`], entries: [] };
  }
  const seen = new Set();
  entries.forEach((entry, idx) => {
    const at = `entry[${idx}]`;
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      errors.push(`${at}: must be an object with keys ${REQUIRED_ENTRY_KEYS.join(', ')}.`);
      return;
    }
    for (const key of Object.keys(entry)) {
      if (!REQUIRED_ENTRY_KEYS.includes(key)) errors.push(`${at}: unknown key '${key}' (allowed: ${REQUIRED_ENTRY_KEYS.join(', ')}) — fail closed.`);
    }
    for (const key of REQUIRED_ENTRY_KEYS) {
      if (!(key in entry)) errors.push(`${at}: missing required field '${key}'.`);
    }
    if (errors.some((e) => e.startsWith(`${at}:`) && (e.includes('missing required') || e.includes('unknown key')))) return;

    if (typeof entry.issue !== 'string' || !/^#\d+$/.test(entry.issue)) {
      errors.push(`${at}: 'issue' must be an issue reference like "#480" (found ${JSON.stringify(entry.issue)}).`);
    }
    if (typeof entry.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(entry.date) || Number.isNaN(Date.parse(entry.date))) {
      errors.push(`${at}: 'date' must be a real YYYY-MM-DD date (found ${JSON.stringify(entry.date)}).`);
    }
    if (typeof entry.file !== 'string' || entry.file.length === 0) {
      errors.push(`${at}: 'file' must be a repo-relative suite path.`);
    } else {
      if (isAbsolute(entry.file) || entry.file.split('/').includes('..')) {
        errors.push(`${at}: 'file' must be a normalised repo-relative path without '..' (found ${JSON.stringify(entry.file)}).`);
      } else if (!PROTECTED_PREFIXES.some((p) => entry.file.startsWith(p))) {
        errors.push(`${at}: 'file' ${JSON.stringify(entry.file)} is not under a protected suite prefix (${PROTECTED_PREFIXES.join(' or ')}) — a declaration may only authorise a frozen-suite file.`);
      }
    }
    if (!Array.isArray(entry.cases) || entry.cases.length === 0) {
      errors.push(`${at}: 'cases' must be a non-empty array of exact full case titles (declarations are per case title, never a file glob).`);
    } else {
      entry.cases.forEach((c, ci) => {
        if (typeof c !== 'string' || c.trim().length === 0 || c !== c.trim()) {
          errors.push(`${at}: cases[${ci}] must be a non-empty, non-padded exact case title (found ${JSON.stringify(c)}).`);
        }
      });
      const unique = new Set(entry.cases);
      if (unique.size !== entry.cases.length) errors.push(`${at}: duplicate case titles inside 'cases' — declarations are per exact title.`);
      for (const c of unique) {
        const dedupKey = `${JSON.stringify(entry.file)}\n${c}`;
        if (seen.has(dedupKey)) errors.push(`${at}: case ${JSON.stringify(c)} of ${JSON.stringify(entry.file)} is already declared by another entry — duplicate declarations are ambiguous, fail closed.`);
        seen.add(dedupKey);
      }
    }
    if (typeof entry.kind !== 'string' || !ADAPTATION_KINDS.includes(entry.kind)) {
      errors.push(`${at}: 'kind' must be one of ${ADAPTATION_KINDS.join(' | ')} (found ${JSON.stringify(entry.kind)}).`);
    }
    if (typeof entry.rationale !== 'string' || entry.rationale.trim().length === 0) {
      errors.push(`${at}: 'rationale' must be a non-empty one-sentence reason.`);
    }
    if (typeof entry.approval !== 'string' || !/^https:\/\/\S+$/.test(entry.approval)) {
      errors.push(`${at}: 'approval' must be an https:// review-decision URL (found ${JSON.stringify(entry.approval)}).`);
    }
  });
  return { errors, entries };
}

function readManifest(manifestPath) {
  if (!existsSync(manifestPath)) {
    return { errors: [`Manifest ${manifestPath} is missing — fail closed (the declared-adaptation route requires the manifest to exist; there is no silent fallback).`], entries: [] };
  }
  return validateManifestText(readFileSync(manifestPath, 'utf8'), manifestPath);
}

// ---------------------------------------------------------------------------
// Declared-entry existence (stale declarations fail closed, always)
// ---------------------------------------------------------------------------

function checkDeclaredEntriesExist(repo, entries, manifestPath) {
  const errors = [];
  for (const [idx, entry] of entries.entries()) {
    const abs = join(repo, entry.file);
    const titles = titlesInFile(abs);
    if (titles === null) {
      errors.push(`Manifest ${manifestPath} entry[${idx}] declares ${JSON.stringify(entry.file)} (${entry.issue}, ${entry.date}) but that file no longer exists at HEAD — stale declaration, fail closed (prune the entry in a reviewed change or restore the file).`);
      continue;
    }
    for (const c of entry.cases) {
      if (!titles.includes(c)) {
        errors.push(`Manifest ${manifestPath} entry[${idx}] declares case ${JSON.stringify(c)} of ${JSON.stringify(entry.file)} (${entry.issue}, ${entry.date}) but no such case title exists in the file at HEAD — stale declaration, fail closed. Exact FULL titles as 'npx playwright test --list' prints them are required (describe prefix included).`);
      }
    }
  }
  return errors;
}

// ---------------------------------------------------------------------------
// MRD cross-check (undeclared suite changes fail closed)
// ---------------------------------------------------------------------------

function gitOutput(args) {
  const r = spawnSync('git', ['-C', args.repo, ...args.cmd], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  if (r.status !== 0) {
    die([`${args.cmd.join(' ')} failed: ${(r.stderr || '').trim()}`]);
  }
  return r.stdout || '';
}

function changedSuiteEntries(repo, base) {
  const out = gitOutput({ repo, cmd: ['diff', '--name-status', '--diff-filter=MRD', `${base}...HEAD`, '--', ...PROTECTED_PREFIXES.map((p) => p.replace(/\/$/, ''))] });
  const items = [];
  for (const line of out.split('\n')) {
    if (!line.trim()) continue;
    const parts = line.split('\t');
    const status = parts[0][0]; // M / D / R (rename detection on)
    if (status === 'R') items.push({ status, oldPath: parts[1], newPath: parts[2] });
    else items.push({ status, path: parts[1] });
  }
  return items;
}

/** Unified-diff `-U0` hunk headers for one file: [{oldStart, oldCount, newStart, newCount}]. */
function diffFileHunks(repo, base, path) {
  const out = gitOutput({ repo, cmd: ['diff', '-U0', `${base}...HEAD`, '--', path] });
  const hunks = [];
  for (const line of out.split('\n')) {
    const m = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
    if (m) hunks.push({ oldStart: Number(m[1]), oldCount: m[2] === undefined ? 1 : Number(m[2]), newStart: Number(m[3]), newCount: m[4] === undefined ? 1 : Number(m[4]) });
  }
  return hunks;
}

function gitShowOrNull(repo, ref, path) {
  const r = spawnSync('git', ['-C', repo, 'show', `${ref}:${path}`], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  return r.status === 0 ? r.stdout : null;
}

function lineRange(start, count) {
  return Array.from({ length: count }, (_, i) => start + i);
}

function titlesTouching(regions, lineNumbers) {
  const touched = new Set();
  for (const r of regions) {
    for (const l of lineNumbers) {
      if (l >= r.start && l <= r.end) { touched.add(r.title); break; }
    }
  }
  return touched;
}

/**
 * Per-case authorization for MODIFIED declared files (loop-1 review finding,
 * #481/PR #497): a declaration authorises edits ONLY inside its declared
 * cases' bodies. Changed `-U0` hunks are attributed to case regions on BOTH
 * sides of the diff — additions/modifications against the HEAD regions,
 * pure deletions against the BASE regions — and every touched case must be
 * declared for that exact file. Hunks outside every case body (describe-level
 * hooks, file-local helpers, imports, file-level code) cannot be attributed
 * and fail closed. R/D keep the file-level checks (a rename/delete can never
 * satisfy a declaration: the declared file/cases must still exist at HEAD).
 */
function checkMrdAgainstManifest(repo, base, entries, manifestPath) {
  const changed = changedSuiteEntries(repo, base);
  if (changed.length === 0) return [];

  const declaredTitlesByFile = new Map();
  for (const e of entries) {
    if (!declaredTitlesByFile.has(e.file)) declaredTitlesByFile.set(e.file, new Set());
    for (const c of e.cases) declaredTitlesByFile.get(e.file).add(c);
  }

  const errors = [];
  const undeclaredFiles = [];
  const caseViolations = [];

  for (const item of changed) {
    const paths = item.oldPath ? [item.oldPath, item.newPath] : [item.path];
    const undeclared = paths.filter((p) => !declaredTitlesByFile.has(p));
    if (undeclared.length > 0) {
      undeclaredFiles.push(...undeclared);
      continue;
    }
    if (item.status !== 'M') continue; // R/D: file-level only (see docblock)

    const declaredTitles = declaredTitlesByFile.get(item.path);
    const headRegions = extractCaseRegions(readFileSync(join(repo, item.path), 'utf8'));
    const baseContent = gitShowOrNull(repo, base, item.path);
    const baseRegions = baseContent === null ? [] : extractCaseRegions(baseContent);

    const touched = new Set();
    const unattributable = [];
    for (const h of diffFileHunks(repo, base, item.path)) {
      if (h.newCount > 0) {
        const t = titlesTouching(headRegions, lineRange(h.newStart, h.newCount));
        if (t.size === 0) unattributable.push(`new lines ${h.newStart}-${h.newStart + h.newCount - 1}`);
        else for (const x of t) touched.add(x);
      }
      if (h.oldCount > 0 && h.newCount === 0) {
        const t = titlesTouching(baseRegions, lineRange(h.oldStart, h.oldCount));
        if (t.size === 0) unattributable.push(`deleted base lines ${h.oldStart}-${h.oldStart + h.oldCount - 1}`);
        else for (const x of t) touched.add(x);
      }
    }
    if (unattributable.length > 0) {
      caseViolations.push(`${item.path} :: changed hunk(s) cannot be attributed to any case body (${unattributable.join('; ')}) — declarations authorise edits ONLY inside declared cases' bodies; describe-level hooks, file-local helpers, imports and file-level code are not authorisable via the manifest.`);
    }
    const undeclaredCases = [...touched].filter((t) => !declaredTitles.has(t));
    if (undeclaredCases.length > 0) {
      caseViolations.push(`${item.path} :: changed case(s) NOT covered by a declaration:\n${undeclaredCases.map((t) => `    - '${t}'`).join('\n')}\n  A declaration authorises edits only inside its declared cases (exact full titles) — every other case in the same file stays protected.`);
    }
  }

  if (undeclaredFiles.length > 0) {
    errors.push([
      'Spec files must never be edited to make Angular pass (PB-2; a wiring need is itself a disposition-register entry):',
      ...undeclaredFiles.map((p) => `  - ${p}`),
      `Undeclared frozen-suite change(s) above — fail closed. The only lawful route is a reviewed declaration in ${manifestPath} (issue, date, file, exact case titles, kind, rationale, approval URL); renames/deletes can never satisfy a declaration (the declared file/cases must still exist at HEAD).`,
    ].join('\n'));
  }
  if (caseViolations.length > 0) {
    errors.push([
      'Spec files must never be edited to make Angular pass (PB-2; a wiring need is itself a disposition-register entry):',
      ...caseViolations.map((v) => `  - ${v}`),
      `Declarations are per exact case, never per file: ${manifestPath} must cover every changed case of a declared file — no silent fallback.`,
    ].join('\n'));
  }
  return errors;
}

// ---------------------------------------------------------------------------
// PB-2 PR-matrix deferral guard (self-reverting interim suspension, #481)
// ---------------------------------------------------------------------------

function jobBlock(lines, jobName) {
  const keyRe = new RegExp(`^  ${jobName}:\\s*$`);
  const start = lines.findIndex((l) => keyRe.test(l));
  if (start < 0) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^  [\w-]+:\s*$/.test(lines[i])) { end = i; break; }
  }
  return lines.slice(start, end);
}

function jobLevelIf(block) {
  if (!block) return null;
  const line = block.find((l) => /^    if:/.test(l));
  return line ? line.replace(/^    if:\s*/, '').trim() : null;
}

/**
 * Does this job-level `if:` expression allow pull_request runs?
 * No `if` (or `always()`) = runs on every triggering event incl. PR → true.
 * A condition that never mentions pull_request (e.g. only workflow_dispatch) → false.
 * `github.event_name != 'pull_request'` → false.
 */
export function allowsPullRequest(expr) {
  if (expr === null || expr === undefined || expr === '' || expr === 'always()') return true;
  if (!expr.includes('pull_request')) return false;
  return !/!=\s*['"]pull_request['"]/.test(expr);
}

/**
 * Consistency of the interim PB-2 PR suspension in the workflow text:
 *   sentinel `# PB2-PR-MATRIX: SUSPENDED` (exactly one) ⇔ parity/parity-compare
 *   do NOT run on pull_request ⇔ the `pb2-pr-deferral` job prints DEFERRAL_LINE.
 *   ACTIVE ⇔ both jobs allow pull_request ⇔ the deferral marker is fully gone.
 */
export function checkWorkflowGuard(workflowText) {
  const errors = [];
  const lines = workflowText.split(/\r?\n/);

  const sentinels = [];
  lines.forEach((l, i) => {
    const m = l.match(/#\s*PB2-PR-MATRIX:\s*(SUSPENDED|ACTIVE)\b/);
    if (m) sentinels.push({ state: m[1], line: i + 1 });
  });
  if (sentinels.length === 0) {
    errors.push(`The managed sentinel line '# PB2-PR-MATRIX: SUSPENDED|ACTIVE' is missing from ${WORKFLOW_REL} — the interim-deferral guard cannot verify the gate state, fail closed (restore the sentinel; never remove the guard silently).`);
    return errors;
  }
  if (sentinels.length > 1) {
    errors.push(`Expected exactly one '# PB2-PR-MATRIX:' sentinel in ${WORKFLOW_REL}, found ${sentinels.length} (lines ${sentinels.map((s) => s.line).join(', ')}) — ambiguous gate state, fail closed.`);
    return errors;
  }
  const state = sentinels[0].state;

  const parityIf = jobLevelIf(jobBlock(lines, 'parity'));
  const compareIf = jobLevelIf(jobBlock(lines, 'parity-compare'));
  const deferralBlock = jobBlock(lines, DEFERRAL_JOB);
  const deferralInJob = Boolean(deferralBlock && deferralBlock.some((l) => l.includes(DEFERRAL_LINE)));
  const deferralAnywhere = lines.some((l) => l.includes(DEFERRAL_LINE));

  if (state === 'SUSPENDED') {
    if (allowsPullRequest(parityIf)) {
      errors.push(`PB2-PR-MATRIX is SUSPENDED but the 'parity' matrix job still runs on pull_request (if: ${JSON.stringify(parityIf)}) — the interim AM-1 deferral is half-removed and preflight fails closed. Restoration is #490's change and must be atomic: allow pull_request on BOTH 'parity' and 'parity-compare', flip the sentinel to ACTIVE, and remove the '${DEFERRAL_JOB}' job in the SAME change.`);
    }
    if (allowsPullRequest(compareIf)) {
      errors.push(`PB2-PR-MATRIX is SUSPENDED but 'parity-compare' still runs on pull_request (if: ${JSON.stringify(compareIf)}) — see the previous message; the restoration must be one atomic #490 change.`);
    }
    if (!deferralBlock) {
      errors.push(`PB2-PR-MATRIX is SUSPENDED but the '${DEFERRAL_JOB}' job is missing from ${WORKFLOW_REL} — without it a PR claims no explicit 'no verdict' deferral line. Re-add it (it must print: ${DEFERRAL_LINE}) or complete the atomic #490 restoration.`);
    } else if (!deferralInJob) {
      errors.push(`PB2-PR-MATRIX is SUSPENDED but '${DEFERRAL_JOB}' no longer prints the canonical deferral line "${DEFERRAL_LINE}" — restore that exact line, or complete the atomic #490 restoration.`);
    }
  } else {
    // ACTIVE
    if (!allowsPullRequest(parityIf)) {
      errors.push(`PB2-PR-MATRIX is ACTIVE but the 'parity' matrix job still does NOT run on pull_request (if: ${JSON.stringify(parityIf)}) — the deferral marker was removed without actually restoring the PR matrix, which would silently drop the PB-2 PR gate. Fail closed: restore the '${DEFERRAL_JOB}' job + SUSPENDED sentinel, or finish the #490 restoration by allowing pull_request on BOTH 'parity' and 'parity-compare'.`);
    }
    if (!allowsPullRequest(compareIf)) {
      errors.push(`PB2-PR-MATRIX is ACTIVE but 'parity-compare' still does NOT run on pull_request (if: ${JSON.stringify(compareIf)}) — see the previous message.`);
    }
    if (deferralAnywhere) {
      errors.push(`PB2-PR-MATRIX is ACTIVE but the deferral marker "${DEFERRAL_LINE}" is still present in ${WORKFLOW_REL} — a restored PB-2 PR verdict must not coexist with a "no verdict claimed" deferral. Remove the '${DEFERRAL_JOB}' job and every occurrence of the line.`);
    }
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const args = parseArgs(process.argv.slice(2));

  // --guard: workflow consistency only.
  if (args.guard) {
    if (!existsSync(args.workflow)) die([`Workflow ${args.workflow} is missing — fail closed.`]);
    const errors = checkWorkflowGuard(readFileSync(args.workflow, 'utf8'));
    if (errors.length) die(errors);
    process.stdout.write('PB-2 PR-matrix deferral guard: workflow state and deferral marker are consistent.\n');
    return;
  }

  // Manifest validation runs ALWAYS (missing/unparsable/partial manifest is a
  // broken integrity mechanism even when no suite file changed this PR).
  const manifest = readManifest(args.manifest);
  if (manifest.errors.length) die(manifest.errors);

  // Declared entries must exist at HEAD (stale file/case → fail closed).
  const staleErrors = checkDeclaredEntriesExist(args.repo, manifest.entries, args.manifest);
  if (staleErrors.length) die(staleErrors);

  if (args.manifestOnly) {
    process.stdout.write(`Manifest ${args.manifest}: valid (${manifest.entries.length} declared adaptation${manifest.entries.length === 1 ? '' : 's'}, all declared files/cases exist at HEAD).\n`);
    return;
  }

  // MRD cross-check needs the merge base.
  if (!args.base) {
    err(`::warning::No --base given — the MRD-vs-manifest cross-check is SKIPPED (manifest + entry-existence checks only). Pass --base <merge-base-sha> for the full gate.`);
  } else {
    const mrdErrors = checkMrdAgainstManifest(args.repo, args.base, manifest.entries, args.manifest);
    if (mrdErrors.length) die(mrdErrors);
    process.stdout.write(`No undeclared M/R/D change under ${PROTECTED_PREFIXES.join(' / ')} between ${args.base}...HEAD (manifest: ${manifest.entries.length} declaration${manifest.entries.length === 1 ? '' : 's'}). Integrity gate OK.\n`);
  }

  // Guard runs in the default mode too: one preflight invocation = whole gate.
  if (!existsSync(args.workflow)) die([`Workflow ${args.workflow} is missing — fail closed.`]);
  const guardErrors = checkWorkflowGuard(readFileSync(args.workflow, 'utf8'));
  if (guardErrors.length) die(guardErrors);
  process.stdout.write('PB-2 PR-matrix deferral guard: consistent.\n');
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) main();
