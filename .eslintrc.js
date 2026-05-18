module.exports = {
  env: {
    es6: true,
    browser: true,
    node: true,
  },
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
  },
  globals: {
    wx: true, App: true, Page: true, getCurrentPages: true,
    getApp: true, Component: true, requirePlugin: true,
  },
  extends: 'eslint:recommended',
  rules: {
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'no-console': 'off',
    'no-undef': 'error',
    'no-extra-semi': 'warn',
    'no-redeclare': 'error',
    'no-empty': 'warn',
    'no-constant-condition': 'warn',
    'no-duplicate-case': 'error',
    'no-irregular-whitespace': 'warn',
    'no-unreachable': 'warn',
  },
  ignorePatterns: ['node_modules/', 'cloudfunctions/*/node_modules/', 'admin/'],
}
