/**
 * Global Setup for Jest
 * Runs once before all test suites
 */

module.exports = async () => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'error'; // Suppress logs during tests

  // Optional: Set up test database connection pool limits
  process.env.DB_POOL_MIN = '1';
  process.env.DB_POOL_MAX = '2';

  console.log('🧪 Jest global setup complete');
};
