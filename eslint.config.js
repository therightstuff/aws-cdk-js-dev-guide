const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  {
    ignores: ['cdk.out/**', 'static-website/**', 'lib/**/*.js'],
  },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.node,
      sourceType: 'module',
    },
    rules: {
      // Add any root-specific rules here
    },
  },
];
