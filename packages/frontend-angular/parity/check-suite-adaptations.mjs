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
 *                    attributed to case bodies on BOTH sides of the diff —
 *                    every non-empty new range against HEAD regions AND every
 *                    non-empty old range against BASE regions (loop-3 review
 *                    correction: replacements included, so an undeclared case
 *                    cannot evade the gate by renaming itself to a declared
 *                    title while its assertions are swapped) — and every
 *                    touched case must be declared on both sides. Hunks
 *                    outside every case body (describe-level hooks, file-local
 *                    helpers, imports, file-level code) are attributed to
 *                    DECLARED support regions (see below) and fail closed
 *                    when unmarked or undeclared, and duplicate full case
 *                    titles make region↔title identity ambiguous → fail
 *                    closed (declaration-level and attribution-level).
 *                    Renames/deletes keep the file-level checks (they can
 *                    never satisfy a declaration).
 *   --manifest-only  Manifest schema (incl. `support`) + declared-entry
 *                    existence + support-region integrity only (no git diff,
 *                    no workflow guard).
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
 *      "approval": "<https:// review-decision URL>",
 *      "support": [                      // OPTIONAL (#498) — bounded file-level
 *           { "label": "imports-env",   // preconditions; see below
 *             "kind": "imports" | "env-resolution" | "identity" | "helper" | "hook",
 *             "reason": "<one sentence>" } ] }]
 *
 * Declared support regions (#498): case-body attribution cannot cover the
 * FILE-LEVEL lines a contract-conformance re-point legitimately needs
 * (header doc-block, imports + env resolution, identity const, helpers,
 * describe-level hooks). A declaration may additionally authorise a bounded,
 * explicitly labelled set of such lines by (a) listing them in the entry's
 * optional `support` array — a closed `kind` enum, a slug `label` and a
 * reason — and (b) wrapping exactly those lines in the spec file with
 * marker comments:
 *
 *   // @suite-adaptation-support:<label>
 *   …authorised file-level lines…
 *   // @suite-adaptation-support:end
 *
 * An unattributable hunk is authorised ONLY inside a marker region whose
 * label is declared for that exact file. Fail closed on: an unmarked
 * unattributable hunk, an undeclared label, a declared label with no marker
 * region, nested / unterminated / empty / duplicated / malformed markers, a
 * region overlapping any case body (case attribution wins; the overlap is
 * ambiguous), and support markers in a file with no declaring manifest
 * entry. A support region is a reviewed permission, never an implicit
 * allowlist: there is no file/glob allowlist and no bypass flag, and plain
 * BASE-side file-level lines are tolerated only when the hunk's new side
 * lies entirely inside declared HEAD support regions (a region wrap or
 * interior edit) — old-side lines inside a case body still require that
 * case's declaration, exactly as before.
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
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '..', '..', '..');

const PROTECTED_PREFIXES = ['packages/frontend/tests/', 'packages/frontend/e2e/'];
const MANIFEST_REL = 'packages/frontend-angular/parity/suite-adaptations.json';
const WORKFLOW_REL = '.github/workflows/frontend-angular-parity.yml';
const ADAPTATION_KINDS = ['contract-conformance', 'founder-decision', 'fixture-fragility'];
const REQUIRED_ENTRY_KEYS = ['issue', 'date', 'file', 'cases', 'kind', 'rationale', 'approval'];
const OPTIONAL_ENTRY_KEYS = ['support'];
const SUPPORT_KINDS = ['imports', 'env-resolution', 'identity', 'helper', 'hook'];
const SUPPORT_ITEM_KEYS = ['label', 'kind', 'reason'];
const SUPPORT_LABEL_RE = /^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/;
const SUPPORT_MARKER_TEXT = '@suite-adaptation-support:';
// Order matters: ':end' must be tested before the start form (a start-form
// regex would otherwise parse the literal label 'end'), and any line that
// LOOKS like a marker but matches neither form is malformed → fail closed.
const SUPPORT_END_RE = /^[ \t]*\/\/[ \t]*@suite-adaptation-support:end[ \t]*$/;
const SUPPORT_START_RE = /^[ \t]*\/\/[ \t]*@suite-adaptation-support:([a-z0-9](?:[a-z0-9._-]*[a-z0-9])?)[ \t]*$/;
const SUPPORT_MARKERISH_RE = /^[ \t]*\/\/[ \t]*@suite-adaptation-support:/;
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

// ---------------------------------------------------------------------------
// Support-marker extraction (#498) — declared file-level support regions
// ---------------------------------------------------------------------------

/**
 * Parse the `// @suite-adaptation-support:<label>` … `:end` marker regions of
 * one spec file. Regions are INCLUSIVE of their two marker lines (adding or
 * moving a whole well-formed region is a unit that attributes cleanly), with
 * 1-based line numbers like `extractCaseRegions`.
 *
 * Structural violations are collected in `errors` (the caller fails closed on
 * ANY of them): stray `:end`, nested markers, unterminated regions, empty
 * regions, duplicate labels, and malformed marker-like lines. Parsing never
 * silently tolerates a marker-looking line it cannot understand.
 */
export function extractSupportRegions(sourceText) {
  const regions = [];
  const errors = [];
  const lines = sourceText.split(/\r?\n/);
  let open = null; // { label, startLine }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const n = i + 1;
    if (SUPPORT_END_RE.test(line)) {
      if (!open) {
        errors.push(`stray '@suite-adaptation-support:end' at line ${n} — no support region is open`);
        continue;
      }
      if (n === open.startLine + 1) {
        errors.push(`empty support region '${open.label}' (lines ${open.startLine}-${n}) — a region must wrap at least one authorised line`);
      }
      regions.push({ label: open.label, start: open.startLine, end: n });
      open = null;
      continue;
    }
    const startMatch = line.match(SUPPORT_START_RE);
    if (startMatch) {
      if (open) {
        errors.push(`nested support marker '${startMatch[1]}' at line ${n} (inside region '${open.label}' opened at line ${open.startLine}) — markers must not nest`);
      } else {
        open = { label: startMatch[1], startLine: n };
      }
    } else if (SUPPORT_MARKERISH_RE.test(line)) {
      errors.push(`malformed support marker at line ${n} (${JSON.stringify(line.trim())}) — the only valid forms are '// @suite-adaptation-support:<label>' and '// @suite-adaptation-support:end' with a lowercase [a-z0-9._-] label`);
    }
  }
  if (open) {
    errors.push(`unterminated support region '${open.label}' (opened at line ${open.startLine}) — missing '@suite-adaptation-support:end'`);
  }
  const byLabel = new Map();
  for (const r of regions) {
    if (!byLabel.has(r.label)) byLabel.set(r.label, []);
    byLabel.get(r.label).push(`${r.start}-${r.end}`);
  }
  for (const [label, spans] of byLabel) {
    if (spans.length > 1) {
      errors.push(`support label '${label}' has ${spans.length} marker regions (lines ${spans.join(', ')}) — duplicate regions for one label are ambiguous, fail closed (use a distinct label per region)`);
    }
  }
  return { regions, errors };
}

function caseTitleAt(regions, line) {
  for (const r of regions) {
    if (line >= r.start && line <= r.end) return r.title;
  }
  return null;
}

function supportLabelAt(regions, line) {
  for (const r of regions) {
    if (line >= r.start && line <= r.end) return r.label;
  }
  return null;
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
      if (!REQUIRED_ENTRY_KEYS.includes(key) && !OPTIONAL_ENTRY_KEYS.includes(key)) errors.push(`${at}: unknown key '${key}' (allowed: ${REQUIRED_ENTRY_KEYS.join(', ')}, optional: ${OPTIONAL_ENTRY_KEYS.join(', ')}) — fail closed.`);
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
    // Optional declared support regions (#498): [{ label, kind, reason }].
    if ('support' in entry) {
      const sup = entry.support;
      if (!Array.isArray(sup) || sup.length === 0) {
        errors.push(`${at}: 'support' must be a non-empty array of { label, kind, reason } objects (omit the key entirely when the entry declares no support regions).`);
      } else {
        sup.forEach((s, si) => {
          const sat = `${at}: support[${si}]`;
          if (s === null || typeof s !== 'object' || Array.isArray(s)) {
            errors.push(`${sat}: must be an object with keys ${SUPPORT_ITEM_KEYS.join(', ')}.`);
            return;
          }
          for (const key of Object.keys(s)) {
            if (!SUPPORT_ITEM_KEYS.includes(key)) errors.push(`${sat}: unknown key '${key}' (allowed: ${SUPPORT_ITEM_KEYS.join(', ')}) — fail closed.`);
          }
          for (const key of SUPPORT_ITEM_KEYS) {
            if (!(key in s)) errors.push(`${sat}: missing required field '${key}'.`);
          }
          if (typeof s.label !== 'string' || !SUPPORT_LABEL_RE.test(s.label) || s.label === 'end') {
            errors.push(`${sat}: 'label' must be a lowercase slug ([a-z0-9._-]; 'end' is reserved for the :end marker) (found ${JSON.stringify(s.label)}).`);
          }
          if (typeof s.kind !== 'string' || !SUPPORT_KINDS.includes(s.kind)) {
            errors.push(`${sat}: 'kind' must be one of ${SUPPORT_KINDS.join(' | ')} (found ${JSON.stringify(s.kind)}).`);
          }
          if (typeof s.reason !== 'string' || s.reason.trim().length === 0) {
            errors.push(`${sat}: 'reason' must be a non-empty one-sentence reason for this support region.`);
          }
        });
        const labels = sup.filter((s) => s !== null && typeof s === 'object' && !Array.isArray(s) && typeof s.label === 'string').map((s) => s.label);
        const uniqueLabels = new Set(labels);
        if (uniqueLabels.size !== labels.length) {
          errors.push(`${at}: duplicate support labels inside 'support' — a region is identified by its label, fail closed.`);
        }
        for (const l of uniqueLabels) {
          const dedupKey = `${JSON.stringify(entry.file)}\nsupport:${l}`;
          if (seen.has(dedupKey)) errors.push(`${at}: support label ${JSON.stringify(l)} of ${JSON.stringify(entry.file)} is already declared by another entry — duplicate support declarations are ambiguous, fail closed.`);
          seen.add(dedupKey);
        }
      }
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
    const regions = existsSync(abs) ? extractCaseRegions(readFileSync(abs, 'utf8')) : null;
    if (regions === null) {
      errors.push(`Manifest ${manifestPath} entry[${idx}] declares ${JSON.stringify(entry.file)} (${entry.issue}, ${entry.date}) but that file no longer exists at HEAD — stale declaration, fail closed (prune the entry in a reviewed change or restore the file).`);
      continue;
    }
    const titles = regions.map((r) => r.title);
    for (const c of entry.cases) {
      const occurrences = titles.filter((t) => t === c).length;
      if (occurrences === 0) {
        errors.push(`Manifest ${manifestPath} entry[${idx}] declares case ${JSON.stringify(c)} of ${JSON.stringify(entry.file)} (${entry.issue}, ${entry.date}) but no such case title exists in the file at HEAD — stale declaration, fail closed. Exact FULL titles as 'npx playwright test --list' prints them are required (describe prefix included).`);
      } else if (occurrences > 1) {
        errors.push(`Manifest ${manifestPath} entry[${idx}] declares case ${JSON.stringify(c)} of ${JSON.stringify(entry.file)}, but that full title occurs ${occurrences}× in the file at HEAD — duplicate case titles make title identity ambiguous, fail closed (titles must be unique per file for a declaration to map to exactly one case).`);
      }
    }
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Support-region integrity (#498, runs ALWAYS like the stale-entry check)
// ---------------------------------------------------------------------------

function listProtectedFiles(repo) {
  const files = [];
  for (const prefix of PROTECTED_PREFIXES) {
    const root = join(repo, prefix);
    if (!existsSync(root)) continue;
    const walk = (dir) => {
      let dirEntries;
      try {
        dirEntries = readdirSync(dir, { withFileTypes: true });
      } catch (e) {
        die([`Cannot list ${dir} (${e.message}) — the support-region integrity check cannot run, fail closed.`]);
      }
      for (const e of dirEntries) {
        const p = join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (e.isFile()) files.push(p);
      }
    };
    walk(root);
  }
  return files;
}

/**
 * Markers only exist where the manifest declares them (fail-closed both
 * directions, in EVERY mode):
 *   - any protected file containing support markers must have an entry whose
 *     `support` array declares every label found in the file;
 *   - every declared support label must have a marker region at HEAD (stale
 *     declarations fail, like stale files/cases);
 *   - marker structure (stray/nested/unterminated/empty/duplicate/malformed)
 *     and case-body overlap fail closed.
 */
function checkSupportIntegrity(repo, entries, manifestPath) {
  const errors = [];
  const declaredLabelsByFile = new Map();
  for (const e of entries) {
    if (!Array.isArray(e.support) || e.support.length === 0) continue;
    if (!declaredLabelsByFile.has(e.file)) declaredLabelsByFile.set(e.file, new Set());
    for (const s of e.support) declaredLabelsByFile.get(e.file).add(s.label);
  }
  const markerLabelsByFile = new Map(); // HEAD state of every marker-bearing protected file

  for (const abs of listProtectedFiles(repo)) {
    const text = readFileSync(abs, 'utf8');
    if (!text.includes(SUPPORT_MARKER_TEXT)) continue;
    const rel = relative(repo, abs).split(sep).join('/');
    const { regions, errors: structural } = extractSupportRegions(text);
    for (const e of structural) errors.push(`${rel} :: ${e} — support-marker structure is invalid, fail closed.`);
    const labels = regions.map((r) => r.label);
    markerLabelsByFile.set(rel, labels);
    const declared = declaredLabelsByFile.get(rel);
    if (!declared) {
      errors.push(`${rel} :: support marker region(s) found (label${labels.length === 1 ? '' : 's'}: ${[...new Set(labels)].map((l) => `'${l}'`).join(', ')}) but no manifest entry declares support for this file — fail closed (${manifestPath}; a support region authorises lines only where a declaring entry's 'support' array lists its label).`);
      continue;
    }
    for (const l of new Set(labels)) {
      if (!declared.has(l)) {
        errors.push(`${rel} :: support region '${l}' is not declared for this file — fail closed (${manifestPath}; add { label, kind, reason } to the declaring entry's 'support' array or remove the markers).`);
      }
    }
    if (structural.length === 0) {
      // Markers must never enclose test()/test.describe() declarations: the
      // case-attribution path governs case bodies, and a region that reaches
      // into one is ambiguous → fail closed, naming the case.
      const caseRegions = extractCaseRegions(text);
      for (const r of regions) {
        for (const c of caseRegions) {
          if (c.start <= r.end && r.start <= c.end) {
            errors.push(`${rel} :: support region '${r.label}' (lines ${r.start}-${r.end}) overlaps the case body of '${c.title}' (lines ${c.start}-${c.end}) — markers must not enclose test()/test.describe() declarations; edits inside a case body go through that case's declaration, and the overlap is ambiguous, fail closed.`);
          }
        }
      }
    }
  }

  for (const [file, labels] of declaredLabelsByFile) {
    const present = markerLabelsByFile.get(file);
    if (!present) {
      if (!existsSync(join(repo, file))) continue; // stale-file check already reports the missing file
      errors.push(`Manifest ${manifestPath} declares support label${labels.size === 1 ? '' : 's'} ${[...labels].map((l) => `'${l}'`).join(', ')} for ${JSON.stringify(file)}, but the file has no support marker region at HEAD — stale declaration, fail closed (prune the 'support' array in a reviewed change or add the markers).`);
      continue;
    }
    for (const l of labels) {
      if (!present.includes(l)) {
        errors.push(`Manifest ${manifestPath} declares support label '${l}' for ${JSON.stringify(file)}, but no marker region with that label exists in the file at HEAD — stale declaration, fail closed (prune the label in a reviewed change or restore the markers).`);
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

/**
 * Per-case + per-support-region authorization for MODIFIED declared files
 * (loop-1/loop-3 review findings, #481/PR #497; support regions added by
 * #498): a declaration authorises edits ONLY inside its declared cases'
 * bodies and inside declared, marker-delimited support regions. Changed
 * `-U0` hunk lines are attributed on BOTH sides of the diff — every new line
 * against the HEAD case/support regions, every old line against the BASE
 * case/support regions (case attribution wins over support attribution) —
 * and every touched case must be declared, every touched support label must
 * be declared for that exact file. Any hunk line inside neither kind of
 * region is unattributable and fails closed, with ONE bounded exception: a
 * BASE-side line that was plain file-level (never inside any region) is
 * tolerated when the SAME hunk's new side exists and lies entirely inside
 * HEAD support regions — i.e. a reviewed wrap or interior rewrite of
 * previously unmarked file-level lines. Old-side lines inside a case body
 * still require that case's declaration (no exception), so an undeclared
 * case cannot be emptied into a support region. R/D keep the file-level
 * checks (a rename/delete can never satisfy a declaration: the declared
 * file/cases must still exist at HEAD).
 */
function checkMrdAgainstManifest(repo, base, entries, manifestPath) {
  const changed = changedSuiteEntries(repo, base);
  if (changed.length === 0) return [];

  const declaredTitlesByFile = new Map();
  const declaredSupportByFile = new Map();
  for (const e of entries) {
    if (!declaredTitlesByFile.has(e.file)) declaredTitlesByFile.set(e.file, new Set());
    for (const c of e.cases) declaredTitlesByFile.get(e.file).add(c);
    if (Array.isArray(e.support) && e.support.length > 0) {
      if (!declaredSupportByFile.has(e.file)) declaredSupportByFile.set(e.file, new Set());
      for (const s of e.support) declaredSupportByFile.get(e.file).add(s.label);
    }
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
    const declaredSupport = declaredSupportByFile.get(item.path);
    const headContent = readFileSync(join(repo, item.path), 'utf8');
    const headRegions = extractCaseRegions(headContent);
    const headSupport = extractSupportRegions(headContent);
    const baseContent = gitShowOrNull(repo, base, item.path);
    const baseRegions = baseContent === null ? [] : extractCaseRegions(baseContent);
    const baseSupport = baseContent === null ? { regions: [], errors: [] } : extractSupportRegions(baseContent);
    // Structural marker violations fail with their own messages; attribution
    // on a structurally broken side cannot be trusted → treat as empty.
    for (const e of headSupport.errors) {
      caseViolations.push(`${item.path} :: ${e} (at HEAD) — support-marker structure is invalid, fail closed.`);
    }
    for (const e of baseSupport.errors) {
      caseViolations.push(`${item.path} :: ${e} (at BASE) — support-marker structure is invalid, fail closed.`);
    }
    const headSupportRegions = headSupport.errors.length === 0 ? headSupport.regions : [];
    const baseSupportRegions = baseSupport.errors.length === 0 ? baseSupport.regions : [];

    // Title identity must be unambiguous on both sides (loop-3 review
    // correction): duplicate full titles make region↔title mapping ambiguous.
    const duplicated = (regions) => {
      const counts = new Map();
      for (const r of regions) counts.set(r.title, (counts.get(r.title) || 0) + 1);
      return [...counts.entries()].filter(([, n]) => n > 1).map(([t, n]) => `'${t}' ×${n}`);
    };
    const dupHead = duplicated(headRegions);
    const dupBase = duplicated(baseRegions);
    if (dupHead.length > 0 || dupBase.length > 0) {
      caseViolations.push(`${item.path} :: duplicate full case title(s) — ambiguous region mapping, fail closed${dupHead.length ? `; HEAD: ${dupHead.join(', ')}` : ''}${dupBase.length ? `; BASE: ${dupBase.join(', ')}` : ''}. Renaming an undeclared case to a declared title is not an authorisation route.`);
    }

    const touched = new Set();
    const unattributable = [];
    const supportTouched = new Set();
    const supportTouchedBase = new Set();
    for (const h of diffFileHunks(repo, base, item.path)) {
      let newOutside = 0;
      let newInsideSupport = 0;
      let oldOutside = 0;
      // BOTH sides of every hunk are attributed line-by-line (loop-3 review
      // correction): new lines against HEAD regions, old lines against BASE
      // regions — replacements included, so an undeclared case cannot evade
      // the gate by being renamed to a declared title while its assertions
      // are swapped. Case regions win over support regions.
      if (h.newCount > 0) {
        for (const l of lineRange(h.newStart, h.newCount)) {
          const t = caseTitleAt(headRegions, l);
          if (t !== null) { touched.add(t); continue; }
          const lbl = supportLabelAt(headSupportRegions, l);
          if (lbl !== null) { supportTouched.add(lbl); newInsideSupport += 1; continue; }
          newOutside += 1;
        }
      }
      if (h.oldCount > 0) {
        for (const l of lineRange(h.oldStart, h.oldCount)) {
          const t = caseTitleAt(baseRegions, l);
          if (t !== null) { touched.add(t); continue; }
          const lbl = supportLabelAt(baseSupportRegions, l);
          if (lbl !== null) { supportTouchedBase.add(lbl); continue; }
          oldOutside += 1;
        }
      }
      if (newOutside > 0) {
        unattributable.push(`new lines ${h.newStart}-${h.newStart + h.newCount - 1}`);
      }
      // The one bounded exception for plain BASE-side file-level lines: only
      // when this hunk's new side exists and EVERY new line sits inside a
      // HEAD support region (a reviewed region wrap / interior rewrite).
      // newCount === 0 (pure deletion of unmarked file-level lines) and any
      // partially-marked hunk stay unattributable.
      if (oldOutside > 0 && !(h.newCount > 0 && newOutside === 0 && newInsideSupport === h.newCount)) {
        unattributable.push(`base lines ${h.oldStart}-${h.oldStart + h.oldCount - 1}`);
      }
    }
    if (unattributable.length > 0) {
      caseViolations.push(`${item.path} :: changed hunk(s) cannot be attributed to any case body or declared support region (${unattributable.join('; ')}) — declarations authorise edits ONLY inside declared cases' bodies and inside declared, marker-delimited support regions ('// @suite-adaptation-support:<label>' … ':end', declared via the manifest entry's 'support' array); unmarked describe-level hooks, file-local helpers, imports and file-level code fail closed.`);
    }
    const undeclaredCases = [...touched].filter((t) => !declaredTitles.has(t));
    if (undeclaredCases.length > 0) {
      caseViolations.push(`${item.path} :: changed case(s) NOT covered by a declaration:\n${undeclaredCases.map((t) => `    - '${t}'`).join('\n')}\n  A declaration authorises edits only inside its declared cases (exact full titles, on BOTH the base and head side of every hunk) — every other case in the same file stays protected.`);
    }
    if (declaredSupport) {
      const undeclaredSupport = [...supportTouched].filter((l) => !declaredSupport.has(l));
      if (undeclaredSupport.length > 0) {
        caseViolations.push(`${item.path} :: changed support region(s) with label(s) NOT declared for this file: ${undeclaredSupport.map((l) => `'${l}'`).join(', ')} — a support region authorises lines only when the manifest entry for this file declares { label, kind, reason } in its 'support' array.`);
      }
    } else if (supportTouched.size > 0) {
      caseViolations.push(`${item.path} :: changed support region(s) ${[...supportTouched].map((l) => `'${l}'`).join(', ')} but no manifest entry declares 'support' for this file — fail closed.`);
    }
    // BASE-side support lines: a label that is still declared is fine; a
    // label whose region is GONE at HEAD is the atomic region-removal route
    // (markers + label retracted in the same reviewed change — the stale
    // declaration check would fail any other shape). A label that is
    // undeclared yet still has a region at HEAD is ambiguous → fail.
    const headSupportLabels = new Set(headSupportRegions.map((r) => r.label));
    const undeclaredBaseSupport = [...supportTouchedBase].filter((l) => !(declaredSupport && declaredSupport.has(l)) && headSupportLabels.has(l));
    if (undeclaredBaseSupport.length > 0) {
      caseViolations.push(`${item.path} :: changed support region(s) on the BASE side with label(s) NOT declared for this file: ${undeclaredBaseSupport.map((l) => `'${l}'`).join(', ')} — fail closed (declared labels authorize their regions; a removed region must be retracted atomically with its declaration).`);
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

  // Declared entries must exist at HEAD (stale file/case → fail closed), and
  // support markers only exist where the manifest declares them (#498, both
  // directions, always — including --manifest-only).
  const staleErrors = checkDeclaredEntriesExist(args.repo, manifest.entries, args.manifest);
  const supportErrors = checkSupportIntegrity(args.repo, manifest.entries, args.manifest);
  if (staleErrors.length) die(staleErrors);
  if (supportErrors.length) die(supportErrors);

  if (args.manifestOnly) {
    process.stdout.write(`Manifest ${args.manifest}: valid (${manifest.entries.length} declared adaptation${manifest.entries.length === 1 ? '' : 's'}, all declared files/cases/support regions exist at HEAD).\n`);
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
