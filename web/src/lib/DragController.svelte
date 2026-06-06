<script lang="ts">
	import type Repositionable from './Repositionable.svelte';
	import { TASKBAR_HEIGHT } from './windowManager';

	export let draggable: Repositionable;
	export let disabled: boolean = false;

	const TITLE_BAR_GRIP = 60; // px of title bar that must stay reachable

	let dragging = false;
	let mouseStartX = 0;
	let mouseStartY = 0;
	let windowStartTop = 0;
	let windowStartLeft = 0;

	function startDrag(e: PointerEvent) {
		if (disabled) return;
		// Don't start a drag (and steal the click) from the title-bar buttons
		if ((e.target as HTMLElement).closest('button')) return;
		dragging = true;
		mouseStartX = e.clientX;
		mouseStartY = e.clientY;
		windowStartLeft = draggable.getWindowPosition().x;
		windowStartTop = draggable.getWindowPosition().y;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	}

	function moveDrag(e: PointerEvent) {
		if (!dragging) return;
		const { width } = draggable.getSize();
		let x = windowStartLeft + (e.clientX - mouseStartX);
		let y = windowStartTop + (e.clientY - mouseStartY);
		// Keep the title bar reachable inside the desktop area
		x = Math.max(-(width - TITLE_BAR_GRIP), Math.min(x, window.innerWidth - TITLE_BAR_GRIP));
		y = Math.max(0, Math.min(y, window.innerHeight - TASKBAR_HEIGHT - 24));
		draggable.updateWindowPosition(x, y);
	}

	function stopDrag() {
		dragging = false;
	}
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div
	class="drag-region"
	on:pointerdown={startDrag}
	on:pointermove={moveDrag}
	on:pointerup={stopDrag}
	on:pointercancel={stopDrag}
>
	<slot />
</div>

<style>
	.drag-region {
		touch-action: none;
	}
</style>
