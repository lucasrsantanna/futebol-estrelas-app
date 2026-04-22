module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js', '**/?(*.)+(spec|test).js'],
  collectCoverageFrom: [
    'js/**/*.js',
    '!js/firebase.js',
    '!js/app.js'
  ],
  coveragePathIgnorePatterns: ['/node_modules/'],
  verbose: true
};
