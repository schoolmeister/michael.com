<script lang="ts">
	import { onMount } from 'svelte';
	import DragController from './DragController.svelte';
	import Repositionable from './Repositionable.svelte';
	import AboutDialog from './AboutDialog.svelte';
	import type { ProjectDef } from './projects';
	import {
		closeWindow,
		focusWindow,
		focusedId,
		minimizeWindow,
		toggleMaximize,
		type OpenWindow
	} from './windowManager';

	export let def: ProjectDef;
	export let win: OpenWindow;

	let windowEl: HTMLElement;
	let draggable: Repositionable;
	let showAbout = false;
	let isMobile = false;

	// On small screens windows are always maximized (mobile-app style)
	$: maximized = win.maximized || isMobile;
	$: focused = $focusedId === win.id;

	const MIN_WIDTH = 150;
	const MIN_HEIGHT = 100;

	// Clamp initial geometry so windows never open larger than the viewport (desktop too)
	let initialW = def.defaultWidth;
	let initialH = def.defaultHeight;
	let initialX = def.defaultX;
	let initialY = def.defaultY;

	onMount(() => {
		const mql = window.matchMedia('(max-width: 768px)');
		isMobile = mql.matches;
		const onChange = (e: MediaQueryListEvent) => (isMobile = e.matches);
		mql.addEventListener('change', onChange);
		return () => mql.removeEventListener('change', onChange);
	});

	if (typeof window !== 'undefined') {
		initialW = Math.min(initialW, window.innerWidth - 20);
		initialH = Math.min(initialH, window.innerHeight - 80);
		initialX = Math.max(0, Math.min(initialX, window.innerWidth - initialW - 10));
		initialY = Math.max(0, Math.min(initialY, window.innerHeight - initialH - 50));
	}

	// Resizing state (corner handles)
	let resizing = false;
	let startX = 0;
	let startY = 0;
	let startWidth = 0;
	let startHeight = 0;
	let startLeft = 0;
	let startTop = 0;
	let resizeDir: string | null = null; // 'se' | 'ne' | 'nw' | 'sw'

	function onResizePointerDown(e: PointerEvent, dir: string) {
		if (maximized) return;
		resizing = true;
		resizeDir = dir;
		startX = e.clientX;
		startY = e.clientY;
		startWidth = windowEl.offsetWidth;
		startHeight = windowEl.offsetHeight;
		const pos = draggable.getWindowPosition();
		startLeft = pos.x;
		startTop = pos.y;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		e.preventDefault();
	}

	function onResizePointerMove(e: PointerEvent) {
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
			if (newHeight > MIN_HEIGHT) draggable.updateWindowPosition(startLeft, startTop + dy);
		} else if (resizeDir === 'sw') {
			newWidth = Math.max(MIN_WIDTH, startWidth - dx);
			newHeight = Math.max(MIN_HEIGHT, startHeight + dy);
			if (newWidth > MIN_WIDTH) draggable.updateWindowPosition(startLeft + dx, startTop);
		} else if (resizeDir === 'nw') {
			newWidth = Math.max(MIN_WIDTH, startWidth - dx);
			newHeight = Math.max(MIN_HEIGHT, startHeight - dy);
			draggable.updateWindowPosition(
				newWidth > MIN_WIDTH ? startLeft + dx : startLeft,
				newHeight > MIN_HEIGHT ? startTop + dy : startTop
			);
		}

		windowEl.style.width = newWidth + 'px';
		windowEl.style.height = newHeight + 'px';
	}

	function onResizePointerUp() {
		resizing = false;
		resizeDir = null;
	}
</script>

<Repositionable
	bind:this={draggable}
	initialPosition={{ x: initialX + 'px', y: initialY + 'px' }}
	z={win.z}
	{maximized}
	hidden={win.minimized}
>
	<div
		class="window"
		class:maximized
		bind:this={windowEl}
		style={`width:${initialW}px;height:${initialH}px;`}
		on:pointerdown={() => focusWindow(win.id)}
	>
		<DragController {draggable} disabled={maximized}>
			<div class="title-bar" class:inactive={!focused}>
				<div class="title-bar-text">{def.title}</div>
				<div class="title-bar-controls">
					<button aria-label="Minimize" on:click={() => minimizeWindow(win.id)}></button>
					{#if win.maximized}
						<button aria-label="Restore" on:click={() => toggleMaximize(win.id)}></button>
					{:else}
						<button aria-label="Maximize" on:click={() => toggleMaximize(win.id)}></button>
					{/if}
					<button aria-label="Help" on:click={() => (showAbout = true)}></button>
					<button aria-label="Close" on:click={() => closeWindow(win.id)}></button>
				</div>
			</div>
		</DragController>
		<div class="window-body">
			<slot>
				<p>There's so much room for activities!</p>
			</slot>
		</div>
		{#if !maximized}
			<!-- Corner resize handles -->
			<!-- svelte-ignore a11y-no-static-element-interactions -->
			<div
				class="resize-handle handle-se"
				aria-hidden="true"
				on:pointerdown={(e) => onResizePointerDown(e, 'se')}
				on:pointermove={onResizePointerMove}
				on:pointerup={onResizePointerUp}
				on:pointercancel={onResizePointerUp}
			></div>
			<!-- svelte-ignore a11y-no-static-element-interactions -->
			<div
				class="resize-handle handle-ne"
				aria-hidden="true"
				on:pointerdown={(e) => onResizePointerDown(e, 'ne')}
				on:pointermove={onResizePointerMove}
				on:pointerup={onResizePointerUp}
				on:pointercancel={onResizePointerUp}
			></div>
			<!-- svelte-ignore a11y-no-static-element-interactions -->
			<div
				class="resize-handle handle-nw"
				aria-hidden="true"
				on:pointerdown={(e) => onResizePointerDown(e, 'nw')}
				on:pointermove={onResizePointerMove}
				on:pointerup={onResizePointerUp}
				on:pointercancel={onResizePointerUp}
			></div>
			<!-- svelte-ignore a11y-no-static-element-interactions -->
			<div
				class="resize-handle handle-sw"
				aria-hidden="true"
				on:pointerdown={(e) => onResizePointerDown(e, 'sw')}
				on:pointermove={onResizePointerMove}
				on:pointerup={onResizePointerUp}
				on:pointercancel={onResizePointerUp}
			></div>
		{/if}
	</div>
</Repositionable>

{#if showAbout}
	<AboutDialog
		title={def.title}
		description={def.description}
		icon={def.icon}
		on:close={() => (showAbout = false)}
	/>
{/if}

<style>
	.window {
		display: flex;
		flex-direction: column;
		position: relative;
		box-sizing: border-box;
	}

	/* !important beats the inline width/height, so un-maximizing restores the old size */
	.window.maximized {
		width: 100vw !important;
		height: calc(100vh - var(--taskbar-h, 30px)) !important;
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

	/* Resize handles */
	.resize-handle {
		position: absolute;
		z-index: 5;
		width: 12px;
		height: 12px;
		border-radius: 2px;
		touch-action: none;
	}
	.handle-se {
		bottom: 0;
		right: 0;
		cursor: nwse-resize;
	}
	.handle-sw {
		bottom: 0;
		left: 0;
		cursor: nesw-resize;
	}
	.handle-ne {
		top: 0;
		right: 0;
		cursor: nesw-resize;
	}
	.handle-nw {
		top: 0;
		left: 0;
		cursor: nwse-resize;
	}
</style>
