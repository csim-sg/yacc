import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

const repoRoot = path.resolve(dirname);
const distTmpEntry = path.join(repoRoot, 'dist-tmp', 'index.js');
const distDir = path.join(repoRoot, 'dist');
const outFile = path.join(distDir, 'index.js');

async function main(): Promise<void> {
  if (!fs.existsSync(distTmpEntry)) {
    throw new Error(
      `Expected compiled entry at ${distTmpEntry}. Run "pnpm run build:tsc" first.`,
    );
  }

  fs.mkdirSync(distDir, { recursive: true });

  await build({
    entryPoints: [distTmpEntry],
    outfile: outFile,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node18',
    sourcemap: true,
    sourcesContent: true,

    // Keep runtime deps in node_modules; we only bundle our code.
    packages: 'external',

    // Reduce noise / keep output deterministic.
    logLevel: 'info',
    color: false,
  });

  fs.rmSync(path.join(repoRoot, 'dist-tmp'), { recursive: true, force: true });
}

main().catch((error: unknown) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
