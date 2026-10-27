/**
 * Contract type generation (MIG-041; SPEC-002 AC-02/AC-07; ADR-023).
 *
 * Generates the single frontend contract-type source from the FROZEN
 * canonical contracts — never edit the generated files by hand:
 *
 *   1. REST      — openapi-typescript over `.docs/migration/openapi.yaml`
 *                  (OpenAPI 3.1) → `src/api/contract/rest-api.gen.ts`.
 *   2. Real-time — openapi-typescript over a mechanical wrapper document
 *                  built from `.docs/migration/schemas/*.schema.json`
 *                  (the binding AsyncAPI/JSON Schema pair per the
 *                  LEDGER-MIG-003-RECONCILED binding_contract block)
 *                  → `src/api/contract/realtime.gen.ts`. The wrapper only
 *                  nests the frozen schemas under `components/schemas` so
 *                  the same OpenAPI generator can emit them; it adds no
 *                  shapes of its own.
 *
 * Run: `npm run contract:gen -w @yacc/frontend`
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';
import openapiTS from 'openapi-typescript';

const here = dirname(fileURLToPath(import.meta.url));
const frontendDir = resolve(here, '..');
const migrationDir = resolve(frontendDir, '../../.docs/migration');
const outDir = join(frontendDir, 'src/api/contract');

const BANNER = `/**
 * GENERATED contract types — single frontend contract source (MIG-041; ADR-023).
 * Source of truth: the frozen canonical contracts in \`.docs/migration/\`.
 * Do not edit by hand — regenerate with \`npm run contract:gen -w @yacc/frontend\`.
 */`;

async function generate(source, outputFile) {
  // openapi-typescript v7 returns a list of TS statements — print them with
  // the TypeScript printer (documented programmatic usage).
  const ast = await openapiTS(source, { pathParamsAsTypes: false });
  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
  const content = printer.printList(
    ts.ListFormat.MultiLine,
    ast,
    ts.createSourceFile(outputFile, '', ts.ScriptTarget.ES2022, false)
  );
  writeFileSync(outputFile, `${BANNER}\n\n${content}`);
  console.log(`  → ${outputFile}`);
}

// --- 1. REST (OpenAPI 3.1) ---
console.log('Generating REST contract types from openapi.yaml …');
await generate(pathToFileURL(join(migrationDir, 'openapi.yaml')), join(outDir, 'rest-api.gen.ts'));

// --- 2. Real-time (AsyncAPI JSON Schemas) ---
console.log('Generating real-time contract types from schemas/*.schema.json …');
const schemasDir = join(migrationDir, 'schemas');
const wrapper = {
  openapi: '3.1.0',
  info: {
    title: 'YACC Real-time API (JSON Schema wrapper)',
    version: '1.0.0-mig-003-canonical',
  },
  paths: {},
  components: { schemas: {} },
};
for (const file of readdirSync(schemasDir)
  .filter((f) => f.endsWith('.schema.json'))
  .sort()) {
  const name = file.replace(/\.schema\.json$/, '');
  // Stable, review-friendly type keys: envelope, conversation-updated, …
  wrapper.components.schemas[name] = JSON.parse(readFileSync(join(schemasDir, file), 'utf8'));
}
await generate(wrapper, join(outDir, 'realtime.gen.ts'));

console.log('Contract types generated (frozen contracts are the single source).');
