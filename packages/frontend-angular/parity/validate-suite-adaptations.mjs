#!/usr/bin/env node
/**
 * ANG-015-P1b (#481) — self-validation for the declared-adaptation integrity
 * gate (`check-suite-adaptations.mjs`).
 *
 * Focused, fast (no browsers, no backend, no network) fail-closed validation,
 * mirroring `validate-merge-browser-reports.mjs`:
 *
 *   1.  Happy path — a DECLARED M change under `packages/frontend/tests` and
 *       one under `packages/frontend/e2e` pass the gate at a real merge base;
 *       authorization is PER CASE (loop-1 review correction): declaring one
 *       case never authorizes edits to another case or to file-level code.
 *   2.  Negative MRD paths — undeclared M, undeclared R (rename), undeclared D
 *       (delete) each fail closed naming the offending file and the manifest
 *       path; a declared D (declared file deleted) fails as a stale
 *       declaration; a declared file whose case title no longer exists fails
 *       as stale; editing a SECOND case (or its assertions) while only the
 *       first is declared fails naming the undeclared case; a deleted line
 *       inside an undeclared case fails via base-side attribution; a
 *       file-level/helper edit in a declared file fails as unattributable.
 *   3.  Manifest schema/shape — missing manifest, unparsable JSON, non-array,
 *       missing required field, unknown key, bad kind, bad date, non-https
 *       approval, empty/duplicate cases, duplicate cross-entry declaration,
 *       file outside the protected prefixes, `..` traversal: all fail closed.
 *   4.  Modes — `--manifest-only` validates schema/existence (incl. `support`)
 *       without a base; a PR with NO suite change and an empty manifest passes.
 *   5.  Title extraction — real frozen suite files (routing-rules-ang010)
 *       yield exactly the real full case titles Playwright prints.
 *   6.  PB-2 PR-matrix deferral guard — consistent SUSPENDED/ACTIVE workflows
 *       pass; every divergent combination fails closed (matrix re-enabled
 *       without removing the deferral marker, marker removed without
 *       re-enabling the matrix, missing/duplicated sentinel, half-restored
 *       parity-compare, deferral line left behind). The REAL workflow at HEAD
 *       must pass.
 *   7.  Declared support regions (#498) — positives for every `kind`
 *       (`imports` | `env-resolution` | `identity` | `helper` | `hook`),
 *       interior edits inside declared regions, combined support+case edits,
 *       `--manifest-only` support validation, atomic region removal; and
 *       EVERY fail-closed negative: the identical edit without markers,
 *       undeclared label, declared-but-absent region (both no-markers and
 *       deleted-region shapes), nested/unterminated/empty/duplicated/
 *       malformed/stray-end markers, region overlapping a case body, markers
 *       in an undeclared file, undeclared-case-emptied-into-a-region evasion,
 *       marker relabelling, and support schema violations (non-array/empty
 *       array/missing label/unknown key/bad kind/empty reason/bad slug/
 *       reserved `end`/cross-entry duplicate label).
 *
 * Run: node packages/frontend-angular/parity/validate-suite-adaptations.mjs
 * (exit 0 = all validations pass; any assertion aborts non-zero)
 *
 * Zero dependencies. Fixtures live in mkdtemp dirs and are cleaned up.
 */
'use strict';

import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const GATE = join(SCRIPT_DIR, 'check-suite-adaptations.mjs');
const REPO_ROOT = resolve(SCRIPT_DIR, '..', '..', '..');

import { extractFullTitles } from './check-suite-adaptations.mjs';

const passed = [];
function ok(name, fn) {
  fn();
  passed.push(name);
  process.stdout.write(`  ok - ${name}\n`);
}

function runGate(repoDir, args) {
  return spawnSync(process.execPath, [GATE, '--repo', repoDir, ...args], {
    encoding: 'utf8',
    timeout: 120_000,
    maxBuffer: 16 * 1024 * 1024,
  });
}

// --- synthetic repo helpers --------------------------------------------------

const SUITE_A = `import { test, expect } from '@playwright/test';

test.describe('Outer group', () => {
  test.describe('Inner group', () => {
    test('CASE-A: does something', async ({ page }) => {
      await page.goto('/');
      await expect(page).toHaveTitle(/yacc/);
    });
    test('CASE-D: rename bait', async ({ page }) => {
      await expect(page).toHaveTitle(/none/);
    });
  });
  test('CASE-B: standalone inside outer', async ({ page }) => {
    await expect(page.locator('body')).toBeVisible();
  });
});

test('CASE-C: top level', async ({ page }) => {
  await page.goto('/login');
});
`;
const E2E_A = `import { test, expect } from '@playwright/test';

test.describe('E2E wrapper', () => {
  test('CASE-E2E: promoted flow', async ({ page }) => {
    await page.goto('/');
  });
});
`;
// Support-region fixture (#498): the PLAIN variant is the base state (no
// markers); the MARKED variant wraps the same file-level lines in declared
// support regions — the exact shape a real consumer (#495's precondition
// hunks) produces.
const SUITE_SUP_PLAIN = `import { test, expect } from '@playwright/test';

import * as nodePath from 'node:path';

const FIX_BASE = process.env.FIX_BASE_URL || 'http://localhost:4200';

const FIX_USER = { email: 'fixture-user@example.com' };

function fixtureToken() {
  return 'fixture-token';
}

test.describe('Support fixture', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(FIX_BASE);
  });

  test('CASE-SUP: support demo', async ({ page }) => {
    await page.goto('/');
  });
});
`;
const SUITE_SUP = `import { test, expect } from '@playwright/test';

// @suite-adaptation-support:fixture-imports
import * as nodePath from 'node:path';
// @suite-adaptation-support:end

// @suite-adaptation-support:fixture-env
const FIX_BASE = process.env.FIX_BASE_URL || 'http://localhost:4200';
// @suite-adaptation-support:end

// @suite-adaptation-support:fixture-identity
const FIX_USER = { email: 'fixture-user@example.com' };
// @suite-adaptation-support:end

// @suite-adaptation-support:fixture-helper
function fixtureToken() {
  return 'fixture-token';
}
// @suite-adaptation-support:end

test.describe('Support fixture', () => {
  // @suite-adaptation-support:fixture-hook
  test.beforeEach(async ({ page }) => {
    await page.goto(FIX_BASE);
  });
  // @suite-adaptation-support:end

  test('CASE-SUP: support demo', async ({ page }) => {
    await page.goto('/');
  });
});
`;
const SUP_FILE = 'packages/frontend/tests/suite-sup.spec.ts';
const TITLE_SUP = 'Support fixture CASE-SUP: support demo';
const SUP_KINDS = [
  ['fixture-imports', 'imports'],
  ['fixture-env', 'env-resolution'],
  ['fixture-identity', 'identity'],
  ['fixture-helper', 'helper'],
  ['fixture-hook', 'hook'],
];
// One interior line edit per region (the exact same edit is reused unmarked
// for the AC-2 negative).
const SUP_EDITS = {
  'fixture-imports': (t) => t.replace("import * as nodePath from 'node:path';", "import * as nodeFs from 'node:fs';"),
  'fixture-env': (t) => t.replace("'http://localhost:4200'", "'http://localhost:4210'"),
  'fixture-identity': (t) => t.replace('fixture-user@example.com', 'other-user@example.com'),
  'fixture-helper': (t) => t.replace("return 'fixture-token';", "return 'other-token';"),
  'fixture-hook': (t) => t.replace('await page.goto(FIX_BASE);', 'await page.waitForLoadState("networkidle");'),
};
const EMPTY_MANIFEST = '[]\n';
const APPROVAL = 'https://github.com/csim-sg/yacc/issues/481#issuecomment-6852529734';
const TITLE_A = 'Outer group Inner group CASE-A: does something';
const TITLE_B = 'Outer group CASE-B: standalone inside outer';
const TITLE_C = 'CASE-C: top level';
const TITLE_D = 'Outer group Inner group CASE-D: rename bait';
const TITLE_E2E = 'E2E wrapper CASE-E2E: promoted flow';

function entry(over = {}) {
  return {
    issue: '#999',
    date: '2026-11-13',
    file: 'packages/frontend/tests/suite-a.spec.ts',
    cases: [TITLE_A],
    kind: 'contract-conformance',
    rationale: 'Reviewed adaptation fixture.',
    approval: APPROVAL,
    ...over,
  };
}

function git(dir, args) {
  const r = spawnSync('git', ['-C', dir, ...args], { encoding: 'utf8' });
  assert.equal(r.status, 0, `git ${args.join(' ')} failed: ${r.stderr}`);
  return r.stdout;
}

/** Fresh repo: base commit with suite files + empty manifest, then a HEAD commit. */
function makeRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'suite-adaptations-'));
  git(dir, ['init', '-q']);
  git(dir, ['symbolic-ref', 'HEAD', 'refs/heads/main']);
  git(dir, ['config', 'user.email', 'gate-fixture@example.com']);
  git(dir, ['config', 'user.name', 'gate fixture']);
  for (const rel of [
    'packages/frontend/tests/suite-a.spec.ts',
    'packages/frontend/tests/suite-sup.spec.ts',
    'packages/frontend/e2e/suite-e2e.e2e.ts',
    'packages/frontend-angular/parity/suite-adaptations.json',
    'docs/README.md',
  ]) {
    mkdirSync(dirname(join(dir, rel)), { recursive: true });
  }
  writeFileSync(join(dir, 'packages/frontend/tests/suite-a.spec.ts'), SUITE_A);
  writeFileSync(join(dir, 'packages/frontend/tests/suite-sup.spec.ts'), SUITE_SUP_PLAIN);
  writeFileSync(join(dir, 'packages/frontend/e2e/suite-e2e.e2e.ts'), E2E_A);
  writeFileSync(join(dir, 'packages/frontend-angular/parity/suite-adaptations.json'), EMPTY_MANIFEST);
  writeFileSync(join(dir, 'docs/README.md'), '# fixture\n');
  // The default gate mode includes the PB-2 matrix deferral guard, so the
  // fixture carries the REAL workflow at HEAD (SUSPENDED state).
  mkdirSync(join(dir, '.github/workflows'), { recursive: true });
  cpSync(join(REPO_ROOT, '.github/workflows/frontend-angular-parity.yml'), join(dir, '.github/workflows/frontend-angular-parity.yml'));
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-qm', 'base']);
  const base = git(dir, ['rev-parse', 'HEAD']).trim();
  return { dir, base };
}

function commitHead(repo, mutate) {
  mutate(repo.dir);
  git(repo.dir, ['add', '-A']);
  git(repo.dir, ['commit', '-qm', 'head']);
}

function writeSupFile(d, text) {
  writeFileSync(join(d, SUP_FILE), text);
}

function writeManifestFile(d, entries) {
  writeFileSync(join(d, 'packages/frontend-angular/parity/suite-adaptations.json'), `${JSON.stringify(entries, null, 2)}\n`);
}

/** A suite-sup entry with declared support regions (#498 schema). */
function supportEntry(support, over = {}) {
  return entry({
    file: SUP_FILE,
    cases: [TITLE_SUP],
    support: support ?? SUP_KINDS.map(([label, kind]) => ({ label, kind, reason: `Fixture support region (${kind}).` })),
    ...over,
  });
}

// --- shared workflow fixtures for the guard -----------------------------------

const WF_SUSPENDED = `name: fixture
jobs:
  parity:
    # PB2-PR-MATRIX: SUSPENDED — interim AM-1 deferral (#481)
    if: github.event_name == 'workflow_dispatch'
  parity-compare:
    needs: [parity]
    if: always() && github.event_name == 'workflow_dispatch'
  pb2-pr-deferral:
    if: github.event_name == 'pull_request'
    steps:
      - run: echo "PB-2 PR verdict deferred to AM-1/#490 — no verdict claimed"
`;
const WF_ACTIVE = `name: fixture
jobs:
  parity:
    strategy:
      matrix:
        project: [chromium, firefox, webkit]
  parity-compare:
    needs: [parity]
    if: always()
`;

function guardOver(overrides = {}) {
  let text = overrides.text ?? WF_SUSPENDED;
  if (overrides.replace) {
    for (const [from, to] of overrides.replace) text = text.replace(from, to);
  }
  if (overrides.append) text += overrides.append;
  return text;
}

// ===========================================================================

process.stdout.write('suite-adaptations gate self-validation\n');

// --- 1. happy paths ---------------------------------------------------------

ok('declared M change under tests/ passes at a real merge base', () => {
  const repo = makeRepo();
  commitHead(repo, (d) => {
    writeFileSync(
      join(d, 'packages/frontend/tests/suite-a.spec.ts'),
      SUITE_A.replace('await expect(page).toHaveTitle(/yacc/);', "await expect(page).toHaveTitle(/YACC/);\n      await expect(page.locator('body')).toBeVisible();"),
    );
    writeFileSync(join(d, 'packages/frontend-angular/parity/suite-adaptations.json'), `${JSON.stringify([entry()], null, 2)}\n`);
  });
  const r = runGate(repo.dir, ['--base', repo.base]);
  assert.equal(r.status, 0, `expected pass, got ${r.status}:\n${r.stdout}\n${r.stderr}`);
});

ok('declared M change under e2e/ passes', () => {
  const repo = makeRepo();
  commitHead(repo, (d) => {
    writeFileSync(
      join(d, 'packages/frontend/e2e/suite-e2e.e2e.ts'),
      E2E_A.replace("await page.goto('/');", "await page.goto('/inbox');"),
    );
    writeFileSync(join(d, 'packages/frontend-angular/parity/suite-adaptations.json'), `${JSON.stringify([entry({ file: 'packages/frontend/e2e/suite-e2e.e2e.ts', cases: [TITLE_E2E] })], null, 2)}\n`);
  });
  const r = runGate(repo.dir, ['--base', repo.base]);
  assert.equal(r.status, 0, `expected pass, got ${r.status}:\n${r.stdout}\n${r.stderr}`);
});

ok('no suite change + empty manifest passes (docs-only PR)', () => {
  const repo = makeRepo();
  commitHead(repo, (d) => writeFileSync(join(d, 'docs/README.md'), '# changed\n'));
  const r = runGate(repo.dir, ['--base', repo.base]);
  assert.equal(r.status, 0, `expected pass, got ${r.status}:\n${r.stdout}\n${r.stderr}`);
});

// --- 2. negative MRD paths ----------------------------------------------------

ok('undeclared M fails closed naming file + manifest path', () => {
  const repo = makeRepo();
  commitHead(repo, (d) => writeFileSync(join(d, 'packages/frontend/tests/suite-a.spec.ts'), SUITE_A.replace('/yacc/', '/x/')));
  const r = runGate(repo.dir, ['--base', repo.base]);
  assert.equal(r.status, 1);
  const out = `${r.stdout}\n${r.stderr}`;
  assert.match(out, /Spec files must never be edited to make Angular pass/);
  assert.match(out, /packages\/frontend\/tests\/suite-a\.spec\.ts/);
  assert.match(out, /suite-adaptations\.json/);
});

ok('undeclared R (rename) fails closed', () => {
  const repo = makeRepo();
  commitHead(repo, (d) => git(d, ['mv', 'packages/frontend/tests/suite-a.spec.ts', 'packages/frontend/tests/suite-a-renamed.spec.ts']));
  const r = runGate(repo.dir, ['--base', repo.base]);
  assert.equal(r.status, 1);
  const out = `${r.stdout}\n${r.stderr}`;
  assert.match(out, /suite-a-renamed\.spec\.ts/);
});

ok('undeclared D (delete) fails closed', () => {
  const repo = makeRepo();
  commitHead(repo, (d) => rmSync(join(d, 'packages/frontend/tests/suite-a.spec.ts')));
  const r = runGate(repo.dir, ['--base', repo.base]);
  assert.equal(r.status, 1);
  const out = `${r.stdout}\n${r.stderr}`;
  assert.match(out, /packages\/frontend\/tests\/suite-a\.spec\.ts/);
});

ok('declared file deleted (D) fails as a stale declaration', () => {
  const repo = makeRepo();
  commitHead(repo, (d) => {
    rmSync(join(d, 'packages/frontend/tests/suite-a.spec.ts'));
    writeFileSync(join(d, 'packages/frontend-angular/parity/suite-adaptations.json'), `${JSON.stringify([entry()], null, 2)}\n`);
  });
  const r = runGate(repo.dir, ['--base', repo.base]);
  assert.equal(r.status, 1);
  const out = `${r.stdout}\n${r.stderr}`;
  assert.match(out, /no longer exists at HEAD/);
});

ok('declared case title no longer in the file fails as stale', () => {
  const repo = makeRepo();
  commitHead(repo, (d) => {
    writeFileSync(join(d, 'packages/frontend/tests/suite-a.spec.ts'), SUITE_A.replace('CASE-A: does something', 'CASE-A: does something else entirely'));
    writeFileSync(join(d, 'packages/frontend-angular/parity/suite-adaptations.json'), `${JSON.stringify([entry()], null, 2)}\n`);
  });
  const r = runGate(repo.dir, ['--base', repo.base]);
  assert.equal(r.status, 1);
  const out = `${r.stdout}\n${r.stderr}`;
  assert.match(out, /no such case title exists in the file at HEAD/);
  assert.match(out, /CASE-A: does something/);
});

// --- 2b. per-case authorization (loop-1 review correction) ---------------------

ok('editing a SECOND, undeclared case in a declared file fails closed naming that case', () => {
  const repo = makeRepo();
  commitHead(repo, (d) => {
    // Change only CASE-B's assertion; manifest declares only CASE-A.
    writeFileSync(join(d, 'packages/frontend/tests/suite-a.spec.ts'), SUITE_A.replace("await expect(page.locator('body')).toBeVisible();", "await expect(page.locator('body')).toContainText('yacc');"));
    writeFileSync(join(d, 'packages/frontend-angular/parity/suite-adaptations.json'), `${JSON.stringify([entry()], null, 2)}\n`);
  });
  const r = runGate(repo.dir, ['--base', repo.base]);
  assert.equal(r.status, 1, `expected fail, got 0:\n${r.stdout}\n${r.stderr}`);
  const out = `${r.stdout}\n${r.stderr}`;
  assert.match(out, /changed case\(s\) NOT covered by a declaration/);
  assert.match(out, /CASE-B: standalone inside outer/);
  assert.match(out, /suite-adaptations\.json/);
});

ok('an assertion change inside an undeclared top-level case fails closed', () => {
  const repo = makeRepo();
  commitHead(repo, (d) => {
    writeFileSync(join(d, 'packages/frontend/tests/suite-a.spec.ts'), SUITE_A.replace("await page.goto('/login');", "await page.goto('/login');\n  await expect(page).toHaveTitle(/x/);"));
    writeFileSync(join(d, 'packages/frontend-angular/parity/suite-adaptations.json'), `${JSON.stringify([entry()], null, 2)}\n`);
  });
  const r = runGate(repo.dir, ['--base', repo.base]);
  assert.equal(r.status, 1);
  const out = `${r.stdout}\n${r.stderr}`;
  assert.match(out, /CASE-C: top level/);
});

ok('a deleted line inside an undeclared case fails via base-side attribution', () => {
  const repo = makeRepo();
  commitHead(repo, (d) => {
    writeFileSync(join(d, 'packages/frontend/tests/suite-a.spec.ts'), SUITE_A.replace("    await expect(page.locator('body')).toBeVisible();\n", ''));
    writeFileSync(join(d, 'packages/frontend-angular/parity/suite-adaptations.json'), `${JSON.stringify([entry()], null, 2)}\n`);
  });
  const r = runGate(repo.dir, ['--base', repo.base]);
  assert.equal(r.status, 1);
  const out = `${r.stdout}\n${r.stderr}`;
  assert.match(out, /CASE-B: standalone inside outer/);
});

ok('a file-level/helper edit in a declared file fails as unattributable', () => {
  const repo = makeRepo();
  commitHead(repo, (d) => {
    writeFileSync(join(d, 'packages/frontend/tests/suite-a.spec.ts'), `import { test, expect } from '@playwright/test';\nimport * as nodeFs from 'node:fs';\n\n${SUITE_A.replace(`import { test, expect } from '@playwright/test';\n\n`, '')}`);
    writeFileSync(join(d, 'packages/frontend-angular/parity/suite-adaptations.json'), `${JSON.stringify([entry()], null, 2)}\n`);
  });
  const r = runGate(repo.dir, ['--base', repo.base]);
  assert.equal(r.status, 1);
  const out = `${r.stdout}\n${r.stderr}`;
  assert.match(out, /cannot be attributed to any case body/);
});

ok('editing two cases with BOTH declared passes', () => {
  const repo = makeRepo();
  commitHead(repo, (d) => {
    writeFileSync(
      join(d, 'packages/frontend/tests/suite-a.spec.ts'),
      SUITE_A
        .replace('await expect(page).toHaveTitle(/yacc/);', "await expect(page).toHaveTitle(/YACC/);")
        .replace("await expect(page.locator('body')).toBeVisible();", "await expect(page.locator('body')).toContainText('yacc');"),
    );
    writeFileSync(join(d, 'packages/frontend-angular/parity/suite-adaptations.json'), `${JSON.stringify([entry({ cases: [TITLE_A, TITLE_B] }), entry({ file: 'packages/frontend/tests/suite-a.spec.ts', cases: [TITLE_C], issue: '#998' })], null, 2)}\n`);
  });
  const r = runGate(repo.dir, ['--base', repo.base]);
  assert.equal(r.status, 0, `expected pass, got ${r.status}:\n${r.stdout}\n${r.stderr}`);
});

ok('a describe-level hook edit between cases fails as unattributable', () => {
  const repo = makeRepo();
  commitHead(repo, (d) => {
    writeFileSync(
      join(d, 'packages/frontend/tests/suite-a.spec.ts'),
      SUITE_A.replace("  test('CASE-B: standalone inside outer', async ({ page }) => {", "  test.beforeEach(async () => { await page.goto('/'); });\n  test('CASE-B: standalone inside outer', async ({ page }) => {"),
    );
    writeFileSync(join(d, 'packages/frontend-angular/parity/suite-adaptations.json'), `${JSON.stringify([entry()], null, 2)}\n`);
  });
  const r = runGate(repo.dir, ['--base', repo.base]);
  assert.equal(r.status, 1);
  const out = `${r.stdout}\n${r.stderr}`;
  assert.match(out, /cannot be attributed to any case body/);
});

// --- 2c. both-side attribution + duplicate-title rejection (loop-3) ------------

ok('rename bypass: undeclared case renamed to a declared title + assertion swapped fails closed', () => {
  const repo = makeRepo();
  commitHead(repo, (d) => {
    // CASE-D (undeclared) renamed to CASE-A's declared title, assertions replaced.
    const renamed = SUITE_A
      .replace(`test('${'CASE-D: rename bait'}', async ({ page }) => {`, `test('${'CASE-A: does something'}', async ({ page }) => {`)
      .replace("      await expect(page).toHaveTitle(/none/);", "      await expect(page).toHaveText('unauthorized');");
    writeFileSync(join(d, 'packages/frontend/tests/suite-a.spec.ts'), renamed);
    writeFileSync(join(d, 'packages/frontend-angular/parity/suite-adaptations.json'), `${JSON.stringify([entry()], null, 2)}\n`);
  });
  const r = runGate(repo.dir, ['--base', repo.base]);
  assert.equal(r.status, 1, `expected fail (bypass must be closed), got 0:\n${r.stdout}\n${r.stderr}`);
  const out = `${r.stdout}\n${r.stderr}`;
  // First violation class for this shape: the declared title now occurs 2× at
  // HEAD, so title identity is ambiguous — fail closed before any attribution.
  assert.match(out, /occurs 2× in the file at HEAD — duplicate case titles make title identity ambiguous/);
});

ok('duplicate full case titles in a declared file fail closed as ambiguous', () => {
  const repo = makeRepo();
  commitHead(repo, (d) => {
    // Title-only rename: CASE-D becomes a second 'CASE-A: does something'.
    writeFileSync(join(d, 'packages/frontend/tests/suite-a.spec.ts'), SUITE_A.replace('CASE-D: rename bait', 'CASE-A: does something'));
    writeFileSync(join(d, 'packages/frontend-angular/parity/suite-adaptations.json'), `${JSON.stringify([entry()], null, 2)}\n`);
  });
  const r = runGate(repo.dir, ['--base', repo.base]);
  assert.equal(r.status, 1);
  const out = `${r.stdout}\n${r.stderr}`;
  assert.match(out, /occurs 2× in the file at HEAD — duplicate case titles make title identity ambiguous/);
});

ok('duplicate titles are rejected even in --manifest-only mode', () => {
  const repo = makeRepo();
  writeFileSync(join(repo.dir, 'packages/frontend/tests/suite-a.spec.ts'), SUITE_A.replace('CASE-D: rename bait', 'CASE-A: does something'));
  writeFileSync(join(repo.dir, 'packages/frontend-angular/parity/suite-adaptations.json'), `${JSON.stringify([entry()], null, 2)}\n`);
  const r = runGate(repo.dir, ['--manifest-only']);
  assert.equal(r.status, 1);
  assert.match(`${r.stdout}\n${r.stderr}`, /duplicate case titles make title identity ambiguous/);
});

ok('a replacement hunk whose BASE side sits in an undeclared case fails even when the new title is declared', () => {
  const repo = makeRepo();
  commitHead(repo, (d) => {
    // Same rename shape, but the bait keeps a UNIQUE new title — only the old
    // lines map to the undeclared CASE-D region, proving old-side attribution
    // fires for replacements, not just pure deletions.
    const renamed = SUITE_A
      .replace('CASE-D: rename bait', 'CASE-D: renamed body')
      .replace("      await expect(page).toHaveTitle(/none/);", "      await expect(page).toHaveText('swapped');");
    writeFileSync(join(d, 'packages/frontend/tests/suite-a.spec.ts'), renamed);
    writeFileSync(join(d, 'packages/frontend-angular/parity/suite-adaptations.json'), `${JSON.stringify([entry({ cases: [TITLE_A, 'Outer group Inner group CASE-D: renamed body'] })], null, 2)}\n`);
  });
  const r = runGate(repo.dir, ['--base', repo.base]);
  assert.equal(r.status, 1);
  const out = `${r.stdout}\n${r.stderr}`;
  assert.match(out, /CASE-D: rename bait/);
});

ok('a legitimate in-case edit keeps passing (both sides inside the declared case)', () => {
  const repo = makeRepo();
  commitHead(repo, (d) => {
    writeFileSync(join(d, 'packages/frontend/tests/suite-a.spec.ts'), SUITE_A.replace("await expect(page).toHaveTitle(/yacc/);\n    });\n    test('CASE-D: rename bait', async ({ page }) => {\n      await expect(page).toHaveTitle(/none/);", "await expect(page).toHaveTitle(/YACC/);\n    });\n    test('CASE-D: rename bait', async ({ page }) => {\n      await expect(page).toHaveTitle(/some/);"));
    writeFileSync(join(d, 'packages/frontend-angular/parity/suite-adaptations.json'), `${JSON.stringify([entry({ cases: [TITLE_A, TITLE_D] })], null, 2)}\n`);
  });
  const r = runGate(repo.dir, ['--base', repo.base]);
  assert.equal(r.status, 0, `expected pass, got ${r.status}:\n${r.stdout}\n${r.stderr}`);
});

// --- 2d. declared support regions (#498) ---------------------------------------
// Marker-wrapped file-level lines are authorised only through a declared
// `support` entry; everything below pins the positive routes and every
// fail-closed negative from the issue.

for (const [label, kind] of SUP_KINDS) {
  ok(`support region positive (${kind}): declared label '${label}' authorises an interior line edit`, () => {
    const repo = makeRepo();
    commitHead(repo, (d) => {
      // wrap the file-level lines AND edit one line inside the region
      writeSupFile(d, SUP_EDITS[label](SUITE_SUP));
      writeManifestFile(d, [supportEntry()]);
    });
    const r = runGate(repo.dir, ['--base', repo.base]);
    assert.equal(r.status, 0, `expected pass, got ${r.status}:\n${r.stdout}\n${r.stderr}`);
  });
}

ok('support region positive: a support edit and a declared case edit pass in the same file', () => {
  const repo = makeRepo();
  commitHead(repo, (d) => {
    // one change: an interior support-region line AND the declared case's
    // body line — both authorised by the same entry
    writeSupFile(d, SUP_EDITS['fixture-helper'](SUITE_SUP).replace("await page.goto('/');", "await page.goto('/login');"));
    writeManifestFile(d, [supportEntry(undefined, { cases: [TITLE_SUP] })]);
  });
  const r = runGate(repo.dir, ['--base', repo.base]);
  assert.equal(r.status, 0, `expected pass, got ${r.status}:\n${r.stdout}\n${r.stderr}`);
});

ok('support region positive: --manifest-only validates declared support (schema + regions + integrity)', () => {
  const repo = makeRepo();
  writeSupFile(repo.dir, SUITE_SUP); // marked working tree, no commit needed
  writeManifestFile(repo.dir, [supportEntry()]);
  const r = runGate(repo.dir, ['--manifest-only']);
  assert.equal(r.status, 0, `expected pass, got ${r.status}:\n${r.stdout}\n${r.stderr}`);
  assert.match(`${r.stdout}\n${r.stderr}`, /support regions exist at HEAD/);
});

ok('support region positive: atomic region removal (markers + label retracted together) passes', () => {
  const repo = makeRepo();
  commitHead(repo, (d) => {
    writeSupFile(d, SUITE_SUP);
    writeManifestFile(d, [supportEntry()]);
  });
  const markedBase = git(repo.dir, ['rev-parse', 'HEAD']).trim();
  commitHead(repo, (d) => {
    // remove the identity region entirely AND retract its label in the same
    // change (exactly the three region lines — surrounding blank lines stay)
    writeSupFile(d, SUITE_SUP.replace("// @suite-adaptation-support:fixture-identity\nconst FIX_USER = { email: 'fixture-user@example.com' };\n// @suite-adaptation-support:end\n", ''));
    writeManifestFile(d, [supportEntry(SUP_KINDS.filter(([l]) => l !== 'fixture-identity').map(([label, kind]) => ({ label, kind, reason: 'Kept region.' })))]);
  });
  const r = runGate(repo.dir, ['--base', markedBase]);
  assert.equal(r.status, 0, `expected pass, got ${r.status}:\n${r.stdout}\n${r.stderr}`);
});

ok('support negative (AC-2): the IDENTICAL file-level edit WITHOUT markers fails naming file + line', () => {
  const repo = makeRepo();
  commitHead(repo, (d) => {
    writeSupFile(d, SUP_EDITS['fixture-env'](SUITE_SUP_PLAIN)); // same edit, unmarked
    // the case is declared, but no support region exists and none is declared
    writeManifestFile(d, [entry({ file: SUP_FILE, cases: [TITLE_SUP] })]);
  });
  const r = runGate(repo.dir, ['--base', repo.base]);
  assert.equal(r.status, 1, `expected fail, got 0:\n${r.stdout}\n${r.stderr}`);
  const out = `${r.stdout}\n${r.stderr}`;
  assert.match(out, /cannot be attributed to any case body/);
  assert.match(out, /suite-sup\.spec\.ts/);
  assert.match(out, /(new|base) lines \d+-\d+/);
});

ok('support negative: a marker region with an UNDECLARED label fails closed', () => {
  const repo = makeRepo();
  commitHead(repo, (d) => {
    writeSupFile(d, `${SUITE_SUP}\n// @suite-adaptation-support:rogue\nconst ROGUE = 1;\n// @suite-adaptation-support:end\n`);
    writeManifestFile(d, [supportEntry()]);
  });
  const r = runGate(repo.dir, ['--base', repo.base]);
  assert.equal(r.status, 1);
  assert.match(`${r.stdout}\n${r.stderr}`, /support region 'rogue' is not declared for this file/);
});

ok('support negative: a declared label with NO marker region fails as stale (--manifest-only)', () => {
  const repo = makeRepo(); // suite-sup stays PLAIN (no markers anywhere)
  writeManifestFile(repo.dir, [supportEntry()]);
  const r = runGate(repo.dir, ['--manifest-only']);
  assert.equal(r.status, 1);
  assert.match(`${r.stdout}\n${r.stderr}`, /the file has no support marker region at HEAD/);
});

ok('support negative: nested markers fail closed', () => {
  const repo = makeRepo();
  commitHead(repo, (d) => {
    writeSupFile(d, SUITE_SUP.replace('// @suite-adaptation-support:fixture-env\n', '// @suite-adaptation-support:fixture-env\n// @suite-adaptation-support:nested-marker\n'));
    writeManifestFile(d, [supportEntry(SUP_KINDS.map(([label, kind]) => ({ label, kind, reason: 'r.' })).concat([{ label: 'nested-marker', kind: 'helper', reason: 'r.' }]))]);
  });
  const r = runGate(repo.dir, ['--base', repo.base]);
  assert.equal(r.status, 1);
  assert.match(`${r.stdout}\n${r.stderr}`, /nested support marker/);
});

ok('support negative: an unterminated marker region fails closed', () => {
  const repo = makeRepo();
  commitHead(repo, (d) => {
    // a top-level region AFTER the describe block that never closes — brace
    // balance and case extraction stay intact, the region is unterminated
    writeSupFile(d, `${SUITE_SUP}\n// @suite-adaptation-support:tail-region\nconst TAIL = 1;\n`);
    writeManifestFile(d, [supportEntry(SUP_KINDS.map(([label, kind]) => ({ label, kind, reason: 'r.' })).concat([{ label: 'tail-region', kind: 'helper', reason: 'r.' }]))]);
  });
  const r = runGate(repo.dir, ['--base', repo.base]);
  assert.equal(r.status, 1);
  assert.match(`${r.stdout}\n${r.stderr}`, /unterminated support region 'tail-region'/);
});

ok('support negative: an EMPTY marker region fails closed', () => {
  const repo = makeRepo();
  commitHead(repo, (d) => {
    writeSupFile(d, `${SUITE_SUP}\n// @suite-adaptation-support:empty-region\n// @suite-adaptation-support:end\n`);
    writeManifestFile(d, [supportEntry(SUP_KINDS.map(([label, kind]) => ({ label, kind, reason: 'r.' })).concat([{ label: 'empty-region', kind: 'helper', reason: 'r.' }]))]);
  });
  const r = runGate(repo.dir, ['--base', repo.base]);
  assert.equal(r.status, 1);
  assert.match(`${r.stdout}\n${r.stderr}`, /empty support region 'empty-region'/);
});

ok('support negative: DUPLICATED marker regions for one label fail closed', () => {
  const repo = makeRepo();
  commitHead(repo, (d) => {
    writeSupFile(d, `${SUITE_SUP}\n// @suite-adaptation-support:fixture-imports\nconst AGAIN = 1;\n// @suite-adaptation-support:end\n`);
    writeManifestFile(d, [supportEntry()]);
  });
  const r = runGate(repo.dir, ['--base', repo.base]);
  assert.equal(r.status, 1);
  assert.match(`${r.stdout}\n${r.stderr}`, /'fixture-imports' has 2 marker regions/);
});

ok('support negative: a malformed marker-looking line fails closed', () => {
  const repo = makeRepo();
  commitHead(repo, (d) => {
    writeSupFile(d, `${SUITE_SUP}\n// @suite-adaptation-support:Bad Label\n// @suite-adaptation-support:end\n`);
    writeManifestFile(d, [supportEntry()]);
  });
  const r = runGate(repo.dir, ['--base', repo.base]);
  assert.equal(r.status, 1);
  assert.match(`${r.stdout}\n${r.stderr}`, /malformed support marker/);
});

ok('support negative: a stray :end marker fails closed', () => {
  const repo = makeRepo();
  commitHead(repo, (d) => {
    writeSupFile(d, `${SUITE_SUP}\n// @suite-adaptation-support:end\n`);
    writeManifestFile(d, [supportEntry()]);
  });
  const r = runGate(repo.dir, ['--base', repo.base]);
  assert.equal(r.status, 1);
  assert.match(`${r.stdout}\n${r.stderr}`, /stray '@suite-adaptation-support:end'/);
});

ok('support negative: a region overlapping a case body fails closed, naming the case', () => {
  const repo = makeRepo();
  commitHead(repo, (d) => {
    writeSupFile(
      d,
      SUITE_SUP.replace(
        "  test('CASE-SUP: support demo', async ({ page }) => {",
        "  // @suite-adaptation-support:case-wrapper\n  test('CASE-SUP: support demo', async ({ page }) => {",
      ).replace(
        "  test('CASE-SUP: support demo', async ({ page }) => {\n    await page.goto('/');\n  });",
        "  test('CASE-SUP: support demo', async ({ page }) => {\n    await page.goto('/');\n  });\n  // @suite-adaptation-support:end",
      ),
    );
    writeManifestFile(d, [supportEntry(SUP_KINDS.map(([label, kind]) => ({ label, kind, reason: 'r.' })).concat([{ label: 'case-wrapper', kind: 'hook', reason: 'r.' }]))]);
  });
  const r = runGate(repo.dir, ['--base', repo.base]);
  assert.equal(r.status, 1);
  const out = `${r.stdout}\n${r.stderr}`;
  assert.match(out, /overlaps the case body of 'Support fixture CASE-SUP: support demo'/);
});

ok('support negative: markers in a file with NO declaring manifest entry fail closed', () => {
  const repo = makeRepo();
  commitHead(repo, (d) => writeSupFile(d, SUITE_SUP)); // marked, but manifest stays []
  const r = runGate(repo.dir, ['--base', repo.base]);
  assert.equal(r.status, 1);
  assert.match(`${r.stdout}\n${r.stderr}`, /no manifest entry declares support for this file/);
});

ok('support negative: an undeclared case emptied toward a support region still fails via base-side case attribution', () => {
  const repo = makeRepo();
  commitHead(repo, (d) => {
    // suite-a gains a NEW declared support region, but CASE-B (undeclared)
    // loses its assertion line in the SAME change — the old side of that
    // hunk sits inside CASE-B's BASE case body, so the case rule wins.
    const suiteAWithRegion = `import { test, expect } from '@playwright/test';\n\n// @suite-adaptation-support:ev-region\nconst EV_HELPER = 'reviewed';\n// @suite-adaptation-support:end\n\n${SUITE_A.replace(`import { test, expect } from '@playwright/test';\n\n`, '')}`;
    writeFileSync(join(d, 'packages/frontend/tests/suite-a.spec.ts'), suiteAWithRegion.replace("    await expect(page.locator('body')).toBeVisible();\n", ''));
    writeFileSync(join(d, 'packages/frontend-angular/parity/suite-adaptations.json'), `${JSON.stringify([{ ...entry(), support: [{ label: 'ev-region', kind: 'helper', reason: 'Reviewed helper region.' }] }], null, 2)}\n`);
  });
  const r = runGate(repo.dir, ['--base', repo.base]);
  assert.equal(r.status, 1, `expected fail, got 0:\n${r.stdout}\n${r.stderr}`);
  const out = `${r.stdout}\n${r.stderr}`;
  assert.match(out, /CASE-B: standalone inside outer/);
  assert.match(out, /NOT covered by a declaration/);
});

ok('support negative: relabelling a declared marker to an undeclared label fails closed', () => {
  const repo = makeRepo();
  commitHead(repo, (d) => {
    writeSupFile(d, SUITE_SUP.replaceAll('fixture-env', 'relabel-b'));
    writeManifestFile(d, [supportEntry()]);
  });
  const r = runGate(repo.dir, ['--base', repo.base]);
  assert.equal(r.status, 1);
  const out = `${r.stdout}\n${r.stderr}`;
  assert.match(out, /'relabel-b' is not declared for this file/);
  assert.match(out, /no marker region with that label exists/); // fixture-env went stale
});

ok('support negative: deleting a declared region while keeping its label fails as stale', () => {
  const repo = makeRepo();
  commitHead(repo, (d) => {
    writeSupFile(d, SUITE_SUP.replace("// @suite-adaptation-support:fixture-identity\nconst FIX_USER = { email: 'fixture-user@example.com' };\n// @suite-adaptation-support:end\n\n", ''));
    writeManifestFile(d, [supportEntry()]); // fixture-identity STILL declared
  });
  const r = runGate(repo.dir, ['--base', repo.base]);
  assert.equal(r.status, 1);
  assert.match(`${r.stdout}\n${r.stderr}`, /declares support label 'fixture-identity'.*no marker region with that label exists/s);
});

// --- 3. manifest schema/shape -------------------------------------------------

const schemaCases = [
  ['missing manifest', (d) => rmSync(join(d, 'packages/frontend-angular/parity/suite-adaptations.json')), /is missing/],
  ['unparsable JSON', (d) => writeFileSync(join(d, 'packages/frontend-angular/parity/suite-adaptations.json'), '{oops'), /not parsable JSON/],
  ['non-array root', (d) => writeFileSync(join(d, 'packages/frontend-angular/parity/suite-adaptations.json'), '{"x":1}'), /must be a JSON array/],
  ['missing required field', (d) => writeFileSync(join(d, 'packages/frontend-angular/parity/suite-adaptations.json'), JSON.stringify([(({ kind, ...e }) => e)(entry())])), /missing required field 'kind'/],
  ['unknown key', (d) => writeFileSync(join(d, 'packages/frontend-angular/parity/suite-adaptations.json'), JSON.stringify([{ ...entry(), extra: 1 }])), /unknown key 'extra'/],
  ['bad kind', (d) => writeFileSync(join(d, 'packages/frontend-angular/parity/suite-adaptations.json'), JSON.stringify([entry({ kind: 'because-i-said-so' })])), /'kind' must be one of/],
  ['bad date', (d) => writeFileSync(join(d, 'packages/frontend-angular/parity/suite-adaptations.json'), JSON.stringify([entry({ date: '11/13/2026' })])), /'date' must be/],
  ['non-https approval', (d) => writeFileSync(join(d, 'packages/frontend-angular/parity/suite-adaptations.json'), JSON.stringify([entry({ approval: 'http://insecure.example/x' })])), /'approval' must be an https/],
  ['empty cases', (d) => writeFileSync(join(d, 'packages/frontend-angular/parity/suite-adaptations.json'), JSON.stringify([entry({ cases: [] })])), /non-empty array of exact full case titles/],
  ['duplicate cases in one entry', (d) => writeFileSync(join(d, 'packages/frontend-angular/parity/suite-adaptations.json'), JSON.stringify([entry({ cases: [TITLE_A, TITLE_A] })])), /duplicate case titles/],
  ['file outside protected prefixes', (d) => writeFileSync(join(d, 'packages/frontend-angular/parity/suite-adaptations.json'), JSON.stringify([entry({ file: 'docs/README.md' })])), /not under a protected suite prefix/],
  ['path traversal', (d) => writeFileSync(join(d, 'packages/frontend-angular/parity/suite-adaptations.json'), JSON.stringify([entry({ file: 'packages/frontend/../tests/suite-a.spec.ts' })])), /without '\.\.'/],
  // support-region schema (#498)
  ['support not an array', (d) => writeManifestFile(d, [{ ...entry({ file: SUP_FILE, cases: [TITLE_SUP] }), support: 'imports' }]), /'support' must be a non-empty array/],
  ['support empty array', (d) => writeManifestFile(d, [{ ...entry({ file: SUP_FILE, cases: [TITLE_SUP] }), support: [] }]), /'support' must be a non-empty array/],
  ['support item missing label', (d) => writeManifestFile(d, [{ ...entry({ file: SUP_FILE, cases: [TITLE_SUP] }), support: [{ kind: 'imports', reason: 'r.' }] }]), /missing required field 'label'/],
  ['support item unknown key', (d) => writeManifestFile(d, [{ ...entry({ file: SUP_FILE, cases: [TITLE_SUP] }), support: [{ label: 'a', kind: 'imports', reason: 'r.', extra: 1 }] }]), /unknown key 'extra'/],
  ['support item bad kind', (d) => writeManifestFile(d, [{ ...entry({ file: SUP_FILE, cases: [TITLE_SUP] }), support: [{ label: 'a', kind: 'docs', reason: 'r.' }] }]), /'kind' must be one of imports \| env-resolution/],
  ['support item empty reason', (d) => writeManifestFile(d, [{ ...entry({ file: SUP_FILE, cases: [TITLE_SUP] }), support: [{ label: 'a', kind: 'imports', reason: '   ' }] }]), /'reason' must be a non-empty/],
  ['support item bad label slug', (d) => writeManifestFile(d, [{ ...entry({ file: SUP_FILE, cases: [TITLE_SUP] }), support: [{ label: 'Bad Label', kind: 'imports', reason: 'r.' }] }]), /'label' must be a lowercase slug/],
  ['support item reserved label end', (d) => writeManifestFile(d, [{ ...entry({ file: SUP_FILE, cases: [TITLE_SUP] }), support: [{ label: 'end', kind: 'imports', reason: 'r.' }] }]), /'label' must be a lowercase slug/],
];

for (const [name, mutate, re] of schemaCases) {
  ok(`manifest schema: ${name} fails closed (--manifest-only)`, () => {
    const repo = makeRepo();
    mutate(repo.dir);
    const r = runGate(repo.dir, ['--manifest-only']);
    assert.equal(r.status, 1, `expected fail, got 0:\n${r.stdout}`);
    assert.match(`${r.stdout}\n${r.stderr}`, re);
  });
}

ok('duplicate cross-entry declaration fails closed', () => {
  const repo = makeRepo();
  writeFileSync(
    join(repo.dir, 'packages/frontend-angular/parity/suite-adaptations.json'),
    JSON.stringify([entry(), entry({ issue: '#998' })], null, 2),
  );
  const r = runGate(repo.dir, ['--manifest-only']);
  assert.equal(r.status, 1);
  assert.match(`${r.stdout}\n${r.stderr}`, /already declared by another entry/);
});

ok('support label duplicated across entries for the same file fails closed', () => {
  const repo = makeRepo();
  writeManifestFile(repo.dir, [
    { ...entry({ file: SUP_FILE, cases: [TITLE_SUP] }), support: [{ label: 'same-label', kind: 'helper', reason: 'r.' }] },
    { ...entry({ file: SUP_FILE, cases: ['CASE-C: top level'], issue: '#998' }), support: [{ label: 'same-label', kind: 'helper', reason: 'r.' }] },
  ]);
  const r = runGate(repo.dir, ['--manifest-only']);
  assert.equal(r.status, 1);
  assert.match(`${r.stdout}\n${r.stderr}`, /support label "same-label" of .* is already declared by another entry/);
});

// --- 4. modes ------------------------------------------------------------------

ok('--manifest-only passes without a base even when a suite file changed', () => {
  const repo = makeRepo();
  commitHead(repo, (d) => writeFileSync(join(d, 'packages/frontend/tests/suite-a.spec.ts'), SUITE_A.replace('/yacc/', '/x/')));
  const r = runGate(repo.dir, ['--manifest-only']);
  assert.equal(r.status, 0, `expected pass, got ${r.status}:\n${r.stdout}\n${r.stderr}`);
});

ok('declared file+case exist but PR did not touch them: gate still passes', () => {
  const repo = makeRepo();
  commitHead(repo, (d) => {
    writeFileSync(join(d, 'packages/frontend-angular/parity/suite-adaptations.json'), `${JSON.stringify([entry()], null, 2)}\n`);
    writeFileSync(join(d, 'docs/README.md'), '# changed\n');
  });
  const r = runGate(repo.dir, ['--base', repo.base]);
  assert.equal(r.status, 0);
});

// --- 5. title extraction against the REAL frozen suite -------------------------

ok('extractFullTitles: nested describes join into full titles (fixture shapes)', () => {
  const titles = extractFullTitles(SUITE_A);
  assert.deepEqual(titles, [TITLE_A, TITLE_D, TITLE_B, TITLE_C]);
  assert.deepEqual(extractFullTitles(E2E_A), [TITLE_E2E]);
});

ok('extractFullTitles: the real frozen routing-rules-ang010 titles are found exactly', () => {
  const realPath = join(REPO_ROOT, 'packages/frontend/tests/routing-rules-ang010.spec.ts');
  const titles = extractFullTitles(readFileSync(realPath, 'utf8'));
  for (const t of [
    'ANG-010 routing rules (real backend) ANG010-RULES-1: ADMIN reaches the page through the gated nav and direct goto; seeded rules render; selection shows details + executions',
    'ANG-010 routing rules (real backend) ANG010-CRUD-1: status toggle persists through PATCH; a seeded-then-deleted rule round-trips the list',
    'ANG-010 routing rules (real backend) ANG010-RBAC-1: USER is bounced to /inbox by the ADMIN route guard and the nav hides Routing Rules',
  ]) {
    assert.ok(titles.includes(t), `full title not extracted from the real suite:\n  ${t}\nextracted:\n  ${titles.join('\n  ')}`);
  }
  assert.ok(titles.length >= 3, `expected the real file's case titles, got ${titles.length}`);
});

// --- 6. PB-2 PR-matrix deferral guard -------------------------------------------

ok('guard: consistent SUSPENDED workflow passes', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sa-guard-'));
  const wf = join(dir, 'wf.yml');
  writeFileSync(wf, WF_SUSPENDED);
  const r = spawnSync(process.execPath, [GATE, '--repo', REPO_ROOT, '--workflow', wf, '--guard'], { encoding: 'utf8', timeout: 120_000 });
  assert.equal(r.status, 0, `expected pass, got ${r.status}:\n${r.stdout}\n${r.stderr}`);
  rmSync(dir, { recursive: true, force: true });
});

ok('guard: consistent ACTIVE (restored) workflow passes', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sa-guard-'));
  const wf = join(dir, 'wf.yml');
  writeFileSync(wf, WF_ACTIVE.replace('jobs:', 'jobs:\n  # PB2-PR-MATRIX: ACTIVE\n'));
  const r = spawnSync(process.execPath, [GATE, '--repo', REPO_ROOT, '--workflow', wf, '--guard'], { encoding: 'utf8', timeout: 120_000 });
  assert.equal(r.status, 0, `expected pass, got ${r.status}:\n${r.stdout}\n${r.stderr}`);
  rmSync(dir, { recursive: true, force: true });
});

ok('guard: matrix re-enabled while still SUSPENDED fails closed', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sa-guard-'));
  const wf = join(dir, 'wf.yml');
  // Restoration half-done: parity/parity-compare allowed on PR, marker + deferral job left in place.
  writeFileSync(wf, guardOver({
    replace: [
      ["    if: github.event_name == 'workflow_dispatch'", '    if: always()'],
      ["    if: always() && github.event_name == 'workflow_dispatch'", '    if: always()'],
    ],
  }));
  const r = spawnSync(process.execPath, [GATE, '--repo', REPO_ROOT, '--workflow', wf, '--guard'], { encoding: 'utf8', timeout: 120_000 });
  assert.equal(r.status, 1);
  assert.match(`${r.stdout}\n${r.stderr}`, /still runs on pull_request.*SUSPENDED|SUSPENDED but/);
  rmSync(dir, { recursive: true, force: true });
});

ok('guard: marker removed while matrix still suspended fails closed', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sa-guard-'));
  const wf = join(dir, 'wf.yml');
  writeFileSync(wf, guardOver({
    replace: [['    # PB2-PR-MATRIX: SUSPENDED — interim AM-1 deferral (#481)\n', '']],
    append: '',
  }));
  const r = spawnSync(process.execPath, [GATE, '--repo', REPO_ROOT, '--workflow', wf, '--guard'], { encoding: 'utf8', timeout: 120_000 });
  assert.equal(r.status, 1);
  assert.match(`${r.stdout}\n${r.stderr}`, /sentinel line .* is missing/);
  rmSync(dir, { recursive: true, force: true });
});

ok('guard: deferral job removed while still SUSPENDED fails closed', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sa-guard-'));
  const wf = join(dir, 'wf.yml');
  const text = WF_SUSPENDED.replace(/  pb2-pr-deferral:[\s\S]*$/, '');
  writeFileSync(wf, text);
  const r = spawnSync(process.execPath, [GATE, '--repo', REPO_ROOT, '--workflow', wf, '--guard'], { encoding: 'utf8', timeout: 120_000 });
  assert.equal(r.status, 1);
  assert.match(`${r.stdout}\n${r.stderr}`, /pb2-pr-deferral.* is missing|deferral job is missing|pb2-pr-deferral' job is missing/);
  rmSync(dir, { recursive: true, force: true });
});

ok('guard: ACTIVE with the deferral line still present fails closed', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sa-guard-'));
  const wf = join(dir, 'wf.yml');
  writeFileSync(wf, guardOver({
    text: WF_ACTIVE.replace('jobs:', 'jobs:\n  # PB2-PR-MATRIX: ACTIVE\n'),
    append: `\n  pb2-pr-deferral:\n    steps:\n      - run: echo "${'PB-2 PR verdict deferred to AM-1/#490 — no verdict claimed'}"\n`,
  }));
  const r = spawnSync(process.execPath, [GATE, '--repo', REPO_ROOT, '--workflow', wf, '--guard'], { encoding: 'utf8', timeout: 120_000 });
  assert.equal(r.status, 1);
  assert.match(`${r.stdout}\n${r.stderr}`, /deferral marker/);
  rmSync(dir, { recursive: true, force: true });
});

ok('guard: duplicated sentinel fails closed', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sa-guard-'));
  const wf = join(dir, 'wf.yml');
  writeFileSync(wf, WF_SUSPENDED + "  other-job:\n    # PB2-PR-MATRIX: ACTIVE\n    steps: []\n");
  const r = spawnSync(process.execPath, [GATE, '--repo', REPO_ROOT, '--workflow', wf, '--guard'], { encoding: 'utf8', timeout: 120_000 });
  assert.equal(r.status, 1);
  assert.match(`${r.stdout}\n${r.stderr}`, /exactly one/);
  rmSync(dir, { recursive: true, force: true });
});

ok('guard: parity-compare half-restored while SUSPENDED fails closed', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sa-guard-'));
  const wf = join(dir, 'wf.yml');
  writeFileSync(wf, guardOver({
    replace: [["    if: always() && github.event_name == 'workflow_dispatch'", "    if: always()"]],
  }));
  const r = spawnSync(process.execPath, [GATE, '--repo', REPO_ROOT, '--workflow', wf, '--guard'], { encoding: 'utf8', timeout: 120_000 });
  assert.equal(r.status, 1);
  assert.match(`${r.stdout}\n${r.stderr}`, /parity-compare.*still runs on pull_request|SUSPENDED but 'parity-compare'/);
  rmSync(dir, { recursive: true, force: true });
});

ok('guard: the REAL workflow at HEAD passes', () => {
  const r = spawnSync(process.execPath, [GATE, '--repo', REPO_ROOT, '--guard'], { encoding: 'utf8', timeout: 120_000 });
  assert.equal(r.status, 0, `expected pass, got ${r.status}:\n${r.stdout}\n${r.stderr}`);
});

ok('gate: the REAL repo at HEAD passes with the real base', () => {
  const base = spawnSync('git', ['-C', REPO_ROOT, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim();
  const r = spawnSync(process.execPath, [GATE, '--repo', REPO_ROOT, '--base', base], { encoding: 'utf8', timeout: 120_000 });
  assert.equal(r.status, 0, `expected pass, got ${r.status}:\n${r.stdout}\n${r.stderr}`);
});

process.stdout.write(`\nself-validation passed (${passed.length} checks)\n`);
