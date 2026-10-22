import js from '@eslint/js';
import tseslint from 'typescript-eslint';

const globals = Object.fromEntries(
    ['console', 'process', 'Buffer', 'URL', 'URLSearchParams', 'fetch', 'AbortController', 'AbortSignal', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'structuredClone', '__dirname', '__filename', 'module', 'require', 'exports'].map(
        (name) => [name, 'readonly']
    )
);

export default tseslint.config({ ignores: ['**/dist/**', '**/node_modules/**', '**/.angular/**', 'docs/database/legacy-migrations/**'] }, js.configs.recommended, ...tseslint.configs.recommended, {
    languageOptions: { globals },
    rules: { 'no-debugger': 'error' }
});
