/**
 * Vitest Setup File
 * Runs before tests run
 */

// Suppress console logs during tests (can override with --verbose flag)
if (process.env.DEBUG !== 'true') {
  // Keep console for critical errors/warnings
  const originalLog = console.log;
  const originalInfo = console.info;
  const originalDebug = console.debug;

  // Only show console output for errors and warnings
  console.log = (...args: any[]) => {
    // Suppress non-critical logs
  };

  console.info = (...args: any[]) => {
    // Suppress info logs
  };

  console.debug = (...args: any[]) => {
    // Suppress debug logs
  };

  // Keep error and warning output
  // console.error and console.warn are not overridden
}
