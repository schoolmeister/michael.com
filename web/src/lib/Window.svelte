<script lang="ts">
	import DragController from './DragController.svelte';
	import type { Position } from './Position';
	import Repositionable from './Repositionable.svelte';

	export let title: string;

	let window: HTMLElement;
	let draggable: Repositionable;
	let minimized = false;

	function minimize(element: HTMLElement) {
		minimized = !minimized;
	}
</script>

<Repositionable bind:this={draggable} initialPosition={{ x: '100px', y: '100px' }}>
	<div class="window">
		<DragController {draggable}>
			<div class="title-bar">
				<div class="title-bar-text">{title}</div>
				<div class="title-bar-controls">
					<button aria-label="Minimize" on:click={(e) => (minimized = true)} />
					<button aria-label="Maximize" on:click={(e) => (minimized = false)} />
					<button aria-label="Close" on:click={(e) => window.parentNode?.removeChild(window)} />
				</div>
			</div>
		</DragController>
		<div class="window-body" class:minimized>
			<slot>
				<p>There's so much room for activities!</p>
			</slot>
		</div>
	</div>
</Repositionable>

<style>
	.window {
		display: flex;
		flex-direction: column;
	}

	.window-body {
		flex-grow: 1;
	}

	.minimized {
		height: auto;
	}
</style>
