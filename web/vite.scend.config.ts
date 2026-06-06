import { defineConfig } from 'vite';

// Standalone build config for the vendored "SCEND" game (web/scend).
// Self-contained vanilla TS + Canvas2D Vite app, built separately from SvelteKit and
// emitted into static/ so it is served at /scend-game/. Mirrors vite.game.config.ts.
export default defineConfig({
	root: 'scend', // serve/build scend/index.html
	base: './', // relative asset URLs so it works under the /scend-game/ subpath
	build: {
		outDir: '../static/scend-game', // emit straight into SvelteKit's static dir
		emptyOutDir: true
	}
});
