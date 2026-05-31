import { defineConfig } from 'vite';

// Standalone build config for the vendored "Ascend" game (web/ascend).
// It is a self-contained vanilla TS + Canvas2D Vite app, built separately from
// SvelteKit and emitted into static/ so it is served at /ascend-game/.
export default defineConfig({
	root: 'ascend', // serve/build ascend/index.html
	base: './', // relative asset URLs so it works under the /ascend-game/ subpath
	build: {
		outDir: '../static/ascend-game', // emit straight into SvelteKit's static dir
		emptyOutDir: true
	}
});
