module.exports = {
  root: true,
  extends: ['expo', 'prettier'],
  ignorePatterns: ['supabase/functions/**'],
  overrides: [
    {
      files: ['src/test-setup.ts'],
      rules: {
        '@typescript-eslint/no-require-imports': 'off',
      },
    },
  ],
};
