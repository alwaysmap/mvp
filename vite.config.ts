import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	// @ts-expect-error - Vite version conflict between vitest and sveltekit
	plugins: [sveltekit()],
	test: {
		include: ['tests/unit/**/*.{test,spec}.{js,ts}', 'src/**/*.{test,spec}.{js,ts}'],
		exclude: ['tests/e2e/**', 'node_modules/**']
	}
});
