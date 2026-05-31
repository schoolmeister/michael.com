<script lang="ts">
	import Window from '$lib/Window.svelte';
</script>

<Window title="Ascend" initialWidth={520} initialHeight={680}>
	<div class="game-wrapper">
		<iframe src="/ascend-game/index.html" title="Ascend"></iframe>
	</div>
</Window>

<style>
	.game-wrapper {
		position: absolute;
		inset: 0;
		display: flex;
	}
	iframe {
		flex: 1;
		width: 100%;
		height: 100%;
		border: none;
		display: block;
	}
</style>
