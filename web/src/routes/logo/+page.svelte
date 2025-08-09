<script lang="ts">
	import { onMount, afterUpdate } from 'svelte';
	import Window from '$lib/Window.svelte';

	/** Public props **/
	export let name = 'michaël.com';
	export let steps = 30; // number of shadow layers (fake extrusion)
	export let dx = 1.0; // x offset increment per layer (px)
	export let dy = 1.0; // y offset increment per layer (px)

	let textEl: HTMLDivElement | null = null; // <div> with the big name

	/**
	 * Build a lightweight pseudo-3D extrusion via text-shadow layers.
	 * Colors blend from magenta -> cyan; glows appended at the end.
	 */
	function applyExtrusion() {
		if (!textEl) return;
		const magenta = [255, 75, 216];
		const cyan = [83, 255, 228];
		const shadows = [];

		for (let i = 1; i <= steps; i++) {
			const a = i / steps;
			const r = Math.round(magenta[0] + (cyan[0] - magenta[0]) * a);
			const g = Math.round(magenta[1] + (cyan[1] - magenta[1]) * a);
			const b = Math.round(magenta[2] + (cyan[2] - magenta[2]) * a);
			const alpha = 0.12 * (1 - a * 0.8);
			shadows.push(
				`${(dx * i).toFixed(1)}px ${(dy * i).toFixed(1)}px 0 rgba(${r},${g},${b},${alpha.toFixed(3)})`
			);
		}
		// outer glow
		shadows.push(
			`0 0 22px rgba(83,255,228,.35)`,
			`0 0 42px rgba(255,75,216,.25)`,
			`0 0 72px rgba(255,75,216,.18)`
		);
		textEl.style.textShadow = shadows.join(',');
	}

	onMount(() => {
		applyExtrusion();
	});
	afterUpdate(() => {
		applyExtrusion();
	});
</script>

<Window title="Logo" initialWidth={900} initialHeight={520} initialX={120} initialY={120}>
	<div class="vapor-scene">
		<div class="vapor-text" bind:this={textEl}>{name}</div>
		<div class="vapor-grid" aria-hidden="true"></div>
	</div>
</Window>

<style>
	/*
   * Customize by setting these CSS variables in your global CSS or a wrapper element:
   * --vapor-bg1, --vapor-bg2, --vapor-magenta, --vapor-cyan, --vapor-sun
   */

	.vapor-scene {
		position: relative;
		width: 100%;
		aspect-ratio: 16/9; /* Parent controls width; height follows */
		border-radius: 24px;
		overflow: hidden;
		box-shadow:
			0 20px 60px rgba(0, 0, 0, 0.5),
			inset 0 0 0 1px rgba(255, 255, 255, 0.07);
		background:
			radial-gradient(
				800px 500px at 50% 30%,
				color-mix(in hsl, var(--vapor-sun, #ffb86b) 30%, transparent),
				transparent 60%
			),
			linear-gradient(180deg, #140423, #0a0716 65%);
		display: grid;
		place-items: center;
		perspective: 1000px;
	}

	.vapor-text {
		position: relative;
		font-family:
			'Orbitron',
			ui-sans-serif,
			system-ui,
			-apple-system,
			Segoe UI,
			Roboto,
			'Helvetica Neue',
			Arial,
			'Noto Sans',
			'Apple Color Emoji',
			'Segoe UI Emoji';
		font-weight: 800;
		letter-spacing: 0.04em;
		font-size: min(13vw, 120px);
		color: white;
		transform-style: preserve-3d;
		animation: spin 16s linear infinite;
		will-change: transform;
		text-shadow:
			0 0 18px rgba(83, 255, 228, 0.35),
			0 0 36px rgba(255, 75, 216, 0.25);
	}

	.vapor-grid {
		position: absolute;
		inset: auto 0 0 0;
		height: 55%;
		background:
			radial-gradient(
				800px 300px at 50% -10%,
				color-mix(in hsl, var(--vapor-magenta, #ff4bd8) 25%, transparent),
				transparent 60%
			),
			linear-gradient(180deg, transparent, rgba(0, 0, 0, 0.65)),
			repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.12) 0 1px, transparent 1px 32px),
			repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.12) 0 1px, transparent 1px 32px);
		transform-origin: 50% 100%;
		transform: rotateX(72deg) translateY(18%) scale(1.2);
		filter: drop-shadow(
			0 -10px 30px color-mix(in hsl, var(--vapor-magenta, #ff4bd8) 25%, transparent)
		);
	}

	@keyframes spin {
		from {
			transform: rotateY(0turn);
		}
		to {
			transform: rotateY(1turn);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.vapor-text {
			animation: none;
		}
	}
</style>
