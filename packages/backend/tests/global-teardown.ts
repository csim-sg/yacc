/**
 * Global Teardown for Vitest
 * Runs once after all test suites
 * 
 * Using ESM format for Vitest
 */

export async function teardown(): Promise<void> {
  // Clean up any remaining connections or resources
  console.log('🧹 Vitest global teardown complete');
}
