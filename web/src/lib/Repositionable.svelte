<script lang="ts">
	import type { Position } from './Position';
	export let initialPosition: Position = { x: '0px', y: '0px' };
	/** Window stacking order. */
	export let z: number = 10;
	/** Fill the desktop area (above the taskbar) instead of floating. */
	export let maximized: boolean = false;
	/** Hide without unmounting (used for minimize, keeps iframe/map/canvas state). */
	export let hidden: boolean = false;
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

	export function getSize() {
		return {
			width: draggableElement.offsetWidth,
			height: draggableElement.offsetHeight
		};
	}
</script>

<div
	class="draggable"
	class:maximized
	class:hidden
	bind:this={draggableElement}
	style:top={initialPosition.y}
	style:left={initialPosition.x}
	style:z-index={z}
>
	<slot />
</div>

<style>
	.draggable {
		position: absolute;
	}

	/* !important beats the inline top/left, so un-maximizing restores the old position */
	.draggable.maximized {
		top: 0 !important;
		left: 0 !important;
	}

	.draggable.hidden {
		display: none;
	}
</style>
