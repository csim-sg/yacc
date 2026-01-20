import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export default async function globalSetup() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const repoRoot = path.resolve(__dirname, '../../..');
  const backendDir = path.join(repoRoot, 'packages', 'backend');

  try {
    execSync('npm run db:fixtures', {
      cwd: backendDir,
      stdio: 'inherit',
    });
  } catch (error) {
    console.error('Failed to seed test fixtures:', error);
    throw error;
  }
}
