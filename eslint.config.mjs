import js from '@eslint/js';
import globals from 'globals';

export default [
    {
        ignores: ['node_modules/**', '.vercel/**', 'docs/media/**', 'supabase/**']
    },
    js.configs.recommended,
    {
        files: ['core/**/*.js', 'fx/**/*.js', 'gameplay/**/*.js', 'ui/**/*.js'],
        languageOptions: {
            sourceType: 'script',
            ecmaVersion: 'latest',
            globals: globals.browser
        }
    },
    {
        files: ['sw.js'],
        languageOptions: {
            sourceType: 'script',
            ecmaVersion: 'latest',
            globals: globals.serviceworker
        }
    },
    {
        files: ['test_smoke.js'],
        languageOptions: {
            sourceType: 'script',
            ecmaVersion: 'latest',
            globals: globals.node
        }
    },
    {
        files: ['eslint.config.mjs'],
        languageOptions: {
            sourceType: 'module',
            ecmaVersion: 'latest',
            globals: globals.node
        }
    },
    {
        rules: {
            'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none' }],
            'no-empty': ['error', { allowEmptyCatch: true }],
            'no-undef': 'error',
            'no-console': 'off'
        }
    }
];
