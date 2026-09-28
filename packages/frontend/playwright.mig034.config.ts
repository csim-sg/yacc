import { defineConfig } from '@playwright/test';
import base from './playwright.config';

/**
 * Local MIG-034 verification config: chromium only, no globalSetup
 * (the DB-seeding global setup targets the Node POC backend).
 * Delete or keep out of VCS — not part of the shipped test matrix.
 */
export default defineConfig({
  ...base,
  globalSetup: undefined,
  projects: [{ name: 'chromium', use: { ...base.projects[0].use } }],
});
