<script lang="ts">
	import type Repositionable from './Repositionable.svelte';

	export let draggable: Repositionable;

	let mouseStartX = 0;
	let mouseStartY = 0;
	let windowStartTop = 0;
	let windowStartLeft = 0;

	function startDrag(e: MouseEvent) {
		mouseStartX = e.clientX;
		mouseStartY = e.clientY;
		windowStartLeft = draggable.getWindowPosition().x;
		windowStartTop = draggable.getWindowPosition().y;

		document.onmousemove = (e) => {
			const windowPos = getNewWindowPositionFromMouse(e.clientX, e.clientY);
			draggable.updateWindowPosition(windowPos.x, windowPos.y);
		};

		document.onmouseup = (e) => {
			stopDrag(e);
		};
	}

	function stopDrag(e: MouseEvent) {
		document.onmousemove = null;
		document.onmouseup = null;
	}

	function getNewWindowPositionFromMouse(mouseX: number, mouseY: number) {
		const windowEndLeft = windowStartLeft + (mouseX - mouseStartX);
		const windowEndTop = windowStartTop + (mouseY - mouseStartY);
		return { x: windowEndLeft, y: windowEndTop };
	}
</script>

<div role="menu" tabindex="0" on:mousedown={(e) => startDrag(e)} on:mouseup={(e) => stopDrag(e)}>
	<slot />
</div>
