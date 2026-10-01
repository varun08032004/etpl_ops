module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: [
    'services/**/*.js',
    'routes/**/*.js',
    '!**/node_modules/**',
  ],
  coverageDirectory: 'coverage',
  verbose: true,
  testTimeout: 30000,
  setupFilesAfterEnv: ['./tests/setup.js'],
  modulePathIgnorePatterns: ['<rootDir>/node_modules/'],
};