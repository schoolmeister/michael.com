import { derived, get, writable } from 'svelte/store';

/** Height of the taskbar in px — keep in sync with --taskbar-h in styles.css. */
export const TASKBAR_HEIGHT = 30;

export interface OpenWindow {
	/** Equal to the project id — one window per project. */
	id: string;
	minimized: boolean;
	maximized: boolean;
	z: number;
}

interface WMState {
	windows: OpenWindow[];
	focusedId: string | null;
	topZ: number;
}

const state = writable<WMState>({ windows: [], focusedId: null, topZ: 10 });

export const windows = derived(state, (s) => s.windows);
export const focusedId = derived(state, (s) => s.focusedId);

function update(id: string, fn: (w: OpenWindow) => OpenWindow): void {
	state.update((s) => ({
		...s,
		windows: s.windows.map((w) => (w.id === id ? fn(w) : w))
	}));
}

/** Open a project's window, or focus (and restore) it if already open. */
export function openWindow(id: string): void {
	state.update((s) => {
		if (s.windows.some((w) => w.id === id)) return s;
		const topZ = s.topZ + 1;
		return {
			windows: [...s.windows, { id, minimized: false, maximized: false, z: topZ }],
			focusedId: id,
			topZ
		};
	});
	focusWindow(id);
}

export function closeWindow(id: string): void {
	state.update((s) => ({
		...s,
		windows: s.windows.filter((w) => w.id !== id),
		focusedId: s.focusedId === id ? null : s.focusedId
	}));
}

/** Bring to front and un-minimize. */
export function focusWindow(id: string): void {
	state.update((s) => {
		const win = s.windows.find((w) => w.id === id);
		if (!win) return s;
		if (s.focusedId === id && !win.minimized) return s;
		const topZ = s.topZ + 1;
		return {
			...s,
			windows: s.windows.map((w) => (w.id === id ? { ...w, minimized: false, z: topZ } : w)),
			focusedId: id,
			topZ
		};
	});
}

export function minimizeWindow(id: string): void {
	state.update((s) => ({
		...s,
		windows: s.windows.map((w) => (w.id === id ? { ...w, minimized: true } : w)),
		focusedId: s.focusedId === id ? null : s.focusedId
	}));
}

/**
 * Taskbar button semantics: minimized → restore + focus;
 * focused → minimize; otherwise → focus.
 */
export function toggleMinimize(id: string): void {
	const s = get(state);
	const win = s.windows.find((w) => w.id === id);
	if (win && !win.minimized && s.focusedId === id) minimizeWindow(id);
	else focusWindow(id);
}

export function toggleMaximize(id: string): void {
	update(id, (w) => ({ ...w, maximized: !w.maximized }));
	focusWindow(id);
}
