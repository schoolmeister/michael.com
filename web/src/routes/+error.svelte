<script lang="ts">
	import { page } from '$app/stores';
	import Window from '$lib/Window.svelte';
	import { browser } from '$app/environment';

	// Set desired dimensions
	const initialWidth = 400;
	const initialHeight = 140;

	// Default fallback (SSR)
	let initialX = 100;
	let initialY = 100;

	if (browser) {
		initialX = Math.max(0, (window.innerWidth - initialWidth) / 2);
		initialY = Math.max(0, (window.innerHeight - initialHeight) / 2);
	}
</script>

<Window title="Critical Error" {initialHeight} {initialWidth} {initialX} {initialY}>
	<div class="error-message">
		<h3>{$page.status}: {$page.error?.message}</h3>
	</div>
</Window>

<style>
	h3 {
		margin: 0;
	}
	.error-message {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
	}
</style>
