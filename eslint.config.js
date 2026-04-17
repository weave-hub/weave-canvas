import { defineConfig, globalIgnores } from 'eslint/config'
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default defineConfig([
  globalIgnores(['dist', 'src-tauri']),
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // shadcn의 *Variants (cva 반환값)은 함수이므로 allowConstantExport로는
      // 허용되지 않음 — 이름 화이트리스트로 shadcn 공식 패턴 허용.
      'react-refresh/only-export-components': [
        'warn',
        {
          allowConstantExport: true,
          allowExportNames: ['buttonVariants', 'badgeVariants'],
        },
      ],
    },
  },
  // 테스트 유틸·테스트 파일은 HMR 대상이 아니므로 react-refresh 룰 비적용
  {
    files: ['src/test/**/*', '**/*.test.{ts,tsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
])
