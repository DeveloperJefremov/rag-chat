import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier/flat';
import { defineConfig, globalIgnores } from 'eslint/config';

const eslintConfig = defineConfig([
	...nextVitals,
	...nextTs,
	// Override default ignores of eslint-config-next.
	prettier,
	{
		rules: {
			'no-console': ['warn'],
			// 'no-unused-vars': ['warn'],
			'no-inner-declarations': ['error', 'functions'],
			'prefer-arrow-callback': 'error',
			'prefer-template': ['warn'],
		},
	},
	globalIgnores([
		// Default ignores of eslint-config-next:
		'.next/**',
		'out/**',
		'build/**',
		'next-env.d.ts',
	]),
]);

export default eslintConfig;
