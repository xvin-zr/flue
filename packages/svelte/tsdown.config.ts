import { defineConfig } from 'tsdown';

export default defineConfig({
	entry: ['src/index.svelte.ts'],
	format: ['esm'],
	platform: 'neutral',
	dts: true,
	clean: true,
	deps: { neverBundle: ['@flue/sdk', 'svelte'] },
});
