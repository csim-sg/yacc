/**
 * Global Teardown for Jest
 * Runs once after all test suites
 * 
 * Using CommonJS export for Jest compatibility
 */

module.exports = async () => {
  // Clean up any remaining connections or resources
  console.log('🧹 Jest global teardown complete');
};
