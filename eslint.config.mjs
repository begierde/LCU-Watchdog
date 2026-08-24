import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'
import vue from 'eslint-plugin-vue'

export default tseslint.config(
  { ignores: ['node_modules', 'out', 'release', 'coverage', 'native/lcu-native/build', 'native/lcu-native/index.cjs'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...vue.configs['flat/recommended'],
  {
    files: ['**/*.ts', '**/*.vue'],
    languageOptions: {
      parserOptions: { parser: tseslint.parser },
      globals: {
        window: 'readonly', document: 'readonly', innerWidth: 'readonly', innerHeight: 'readonly',
        crypto: 'readonly', structuredClone: 'readonly', console: 'readonly', URL: 'readonly'
      }
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'vue/multi-word-component-names': 'off',
      'vue/max-attributes-per-line': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'vue/html-self-closing': 'off',
      'vue/attributes-order': 'off'
    }
  },
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: {
        window: 'readonly', document: 'readonly', innerWidth: 'readonly', innerHeight: 'readonly',
        console: 'readonly', URL: 'readonly', structuredClone: 'readonly'
      }
    }
  }
)
