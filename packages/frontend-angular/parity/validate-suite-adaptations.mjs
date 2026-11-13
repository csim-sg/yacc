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
 *   4.  Modes — `--manifest-only` validates schema/existence without a base;
 *       a PR with NO suite change and an empty manifest passes.
 *   5.  Title extraction — real frozen suite files (routing-rules-ang010)
 *       yield exactly the real full case titles Playwright prints.
 *   6.  PB-2 PR-matrix deferral guard — consistent SUSPENDED/ACTIVE workflows
 *       pass; every divergent combination fails closed (matrix re-enabled
 *       without removing the deferral marker, marker removed without
 *       re-enabling the matrix, missing/duplicated sentinel, half-restored
 *       parity-compare, deferral line left behind). The REAL workflow at HEAD
 *       must pass.
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
const EMPTY_MANIFEST = '[]\n';
const APPROVAL = 'https://github.com/csim-sg/yacc/issues/481#issuecomment-6852529734';
const TITLE_A = 'Outer group Inner group CASE-A: does something';
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
    'packages/frontend/e2e/suite-e2e.e2e.ts',
    'packages/frontend-angular/parity/suite-adaptations.json',
    'docs/README.md',
  ]) {
    mkdirSync(dirname(join(dir, rel)), { recursive: true });
  }
  writeFileSync(join(dir, 'packages/frontend/tests/suite-a.spec.ts'), SUITE_A);
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

const TITLE_B = 'Outer group CASE-B: standalone inside outer';
const TITLE_C = 'CASE-C: top level';

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
  assert.deepEqual(titles, [TITLE_A, 'Outer group CASE-B: standalone inside outer', 'CASE-C: top level']);
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
