<script lang="ts">
	import DragController from './DragController.svelte';
	import Repositionable from './Repositionable.svelte';
	import { createEventDispatcher } from 'svelte';

	export let title: string;

	let window: HTMLElement;
	let draggable: Repositionable;
	let minimized = false;
	// Track resizing state
	let resizing = false;
	let startX = 0;
	let startY = 0;
	let startWidth = 0;
	let startHeight = 0;
	let startLeft = 0;
	let startTop = 0;
	let draggableEl: HTMLElement | null = null;
	let resizeDir: string | null = null; // e.g. 'e', 's', 'se', 'w', 'n', 'nw', 'ne', 'sw'

	const MIN_WIDTH = 150;
	const MIN_HEIGHT = 100;
	const dispatch = createEventDispatcher();

	function minimize(element: HTMLElement) {
		minimized = !minimized;
	}

	function onResizeMouseDown(e: MouseEvent, dir: string) {
		if (minimized) return;
		resizing = true;
		resizeDir = dir;
		startX = e.clientX;
		startY = e.clientY;
		startWidth = window.offsetWidth;
		startHeight = window.offsetHeight;
		draggableEl = (window as any).parentElement; // .draggable wrapper
		if (draggableEl) {
			startLeft = draggableEl.offsetLeft;
			startTop = draggableEl.offsetTop;
		}
		document.addEventListener('mousemove', onResizeMouseMove);
		document.addEventListener('mouseup', onResizeMouseUp, { once: true });
		// Prevent selecting text while resizing
		e.preventDefault();
	}

	function onResizeMouseMove(e: MouseEvent) {
		if (!resizing || !resizeDir) return;
		const dx = e.clientX - startX;
		const dy = e.clientY - startY;
		let newWidth = startWidth;
		let newHeight = startHeight;
		// Corner-based resizing only; use stored starting left/top to avoid cumulative drift
		if (resizeDir === 'se') {
			newWidth = Math.max(MIN_WIDTH, startWidth + dx);
			newHeight = Math.max(MIN_HEIGHT, startHeight + dy);
		} else if (resizeDir === 'ne') {
			newWidth = Math.max(MIN_WIDTH, startWidth + dx);
			newHeight = Math.max(MIN_HEIGHT, startHeight - dy);
			if (draggableEl && newHeight > MIN_HEIGHT) draggableEl.style.top = startTop + dy + 'px';
		} else if (resizeDir === 'sw') {
			newWidth = Math.max(MIN_WIDTH, startWidth - dx);
			if (draggableEl && newWidth > MIN_WIDTH) draggableEl.style.left = startLeft + dx + 'px';
			newHeight = Math.max(MIN_HEIGHT, startHeight + dy);
		} else if (resizeDir === 'nw') {
			newWidth = Math.max(MIN_WIDTH, startWidth - dx);
			if (draggableEl && newWidth > MIN_WIDTH) draggableEl.style.left = startLeft + dx + 'px';
			newHeight = Math.max(MIN_HEIGHT, startHeight - dy);
			if (draggableEl && newHeight > MIN_HEIGHT) draggableEl.style.top = startTop + dy + 'px';
		}

		window.style.width = newWidth + 'px';
		window.style.height = newHeight + 'px';
		dispatch('resize', { width: newWidth, height: newHeight });
	}

	function onResizeMouseUp() {
		resizing = false;
		resizeDir = null;
		document.removeEventListener('mousemove', onResizeMouseMove);
		dispatch('resizeend', {
			width: window.offsetWidth,
			height: window.offsetHeight
		});
	}
</script>

<Repositionable bind:this={draggable} initialPosition={{ x: '100px', y: '100px' }}>
	<div class="window" bind:this={window}>
		<DragController {draggable}>
			<div class="title-bar">
				<div class="title-bar-text">{title}</div>
				<div class="title-bar-controls">
					<button aria-label="Minimize" on:click={(e) => (minimized = true)}></button>
					<button aria-label="Maximize" on:click={(e) => (minimized = false)}></button>
					<button aria-label="Close" on:click={(e) => window.parentNode?.removeChild(window)}
					></button>
				</div>
			</div>
		</DragController>
		<div class="window-body" class:minimized>
			<slot>
				<p>There's so much room for activities!</p>
			</slot>
		</div>
		<!-- Resize handles -->
		<!-- Resize handles with ARIA roles for accessibility -->
		<!-- svelte-ignore a11y-no-static-element-interactions -->
		<div
			class="resize-handle handle-se"
			aria-hidden="true"
			on:mousedown={(e) => onResizeMouseDown(e, 'se')}
		></div>
		<!-- svelte-ignore a11y-no-static-element-interactions -->
		<div
			class="resize-handle handle-ne"
			aria-hidden="true"
			on:mousedown={(e) => onResizeMouseDown(e, 'ne')}
		></div>
		<!-- svelte-ignore a11y-no-static-element-interactions -->
		<div
			class="resize-handle handle-nw"
			aria-hidden="true"
			on:mousedown={(e) => onResizeMouseDown(e, 'nw')}
		></div>
		<!-- svelte-ignore a11y-no-static-element-interactions -->
		<div
			class="resize-handle handle-sw"
			aria-hidden="true"
			on:mousedown={(e) => onResizeMouseDown(e, 'sw')}
		></div>
	</div>
</Repositionable>

<style>
	.window {
		display: flex;
		flex-direction: column;
		/* Provide an initial size */
		width: 400px;
		height: 300px;
		position: relative;
		box-sizing: border-box;
	}

	.window-body {
		flex-grow: 1;
		position: relative; /* allow absolutely positioned children (e.g., map) */
		overflow: hidden; /* prevent content spilling outside on resize */
		display: flex;
		flex-direction: column;
	}
	/* Make immediate block children not exceed container */
	.window-body > * {
		max-width: 100%;
		max-height: 100%;
	}

	.minimized {
		height: auto;
	}

	/* Resize handles */
	.resize-handle {
		position: absolute;
		z-index: 5;
		width: 10px;
		height: 10px;
		/* background: rgba(0,0,0,0.15); */
		/* border: 1px solid rgba(255,255,255,0.6); */
		/* box-shadow: inset 0 0 2px rgba(0,0,0,0.4); */
		cursor: nwse-resize;
		border-radius: 2px;
	}
	/* Corner positions (single definition each) */
	.handle-se {
		width: 12px;
		height: 12px;
		bottom: 0;
		right: 0;
		cursor: nwse-resize;
	}
	.handle-sw {
		width: 12px;
		height: 12px;
		bottom: 0;
		left: 0;
		cursor: nesw-resize;
	}
	.handle-ne {
		width: 12px;
		height: 12px;
		top: 0;
		right: 0;
		cursor: nesw-resize;
	}
	.handle-nw {
		width: 12px;
		height: 12px;
		top: 0;
		left: 0;
		cursor: nwse-resize;
	}
</style>
