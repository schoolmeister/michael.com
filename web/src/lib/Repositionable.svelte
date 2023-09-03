<script lang="ts">
	import type { Position } from './Position';
	export let initialPosition: Position = { x: '0px', y: '0px' };
	let draggableElement: HTMLElement;

	export function updateWindowPosition(x: number, y: number) {
		draggableElement.style.left = x + 'px';
		draggableElement.style.top = y + 'px';
	}

	export function getWindowPosition() {
		return {
			x: draggableElement.offsetLeft,
			y: draggableElement.offsetTop
		};
	}
</script>

<div
	class="draggable"
	bind:this={draggableElement}
	style:top={initialPosition.y}
	style:left={initialPosition.x}
>
	<slot />
</div>

<style>
	.draggable {
		position: absolute;
	}
</style>
