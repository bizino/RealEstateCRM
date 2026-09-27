module.exports = {
    testEnvironment: 'node',
    roots: ['<rootDir>/tests'],
    globalSetup: '<rootDir>/tests/globalSetup.js',
    globalTeardown: '<rootDir>/tests/globalTeardown.js',
    testTimeout: 30000,
};
