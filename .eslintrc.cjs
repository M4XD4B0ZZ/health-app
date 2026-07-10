module.exports = {
  root: true,
  extends: ['expo', 'prettier'],
  ignorePatterns: ['supabase/functions/**'],
  rules: {
    // P2-002: `src/infrastructure/supabase/supabaseClient.ts` is the single source of truth
    // for the Supabase client. No other module may create its own client instance.
    'no-restricted-imports': [
      'error',
      {
        paths: [
          {
            name: '@supabase/supabase-js',
            importNames: ['createClient'],
            message:
              'Do not call createClient() directly. Import the shared `supabase` client from `src/infrastructure/supabase/supabaseClient.ts` instead (P2-002: single Supabase client).',
          },
        ],
      },
    ],
    'no-restricted-syntax': [
      'error',
      {
        selector: "CallExpression[callee.name='fetch'] Literal[value=/functions\\/v1/]",
        message:
          'Do not manually fetch() Supabase Edge Function URLs. Use the shared `supabase` client (e.g. supabase.functions.invoke(...)) instead (P2-002: single Supabase client).',
      },
    ],
  },
  overrides: [
    {
      files: ['src/test-setup.ts'],
      rules: {
        '@typescript-eslint/no-require-imports': 'off',
      },
    },
    {
      files: ['src/infrastructure/supabase/supabaseClient.ts'],
      rules: {
        'no-restricted-imports': 'off',
      },
    },
  ],
};
