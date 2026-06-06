import type { Component } from 'svelte';

import image_uienradar from '$lib/images/uienradar.png';
import image_tree from '$lib/images/tree-icon.png';
import image_notepad from '$lib/images/notepad.png';
import image_connected_world from '$lib/images/connected-world.png';
import image_climber from '$lib/images/climber.png';
import image_scend from '$lib/images/scend.svg';

// Component shells are imported eagerly (dynamic import() of .svelte files corrupts
// SvelteKit's dev SSR style inlining). The heavy deps (Leaflet/Three) are still lazy:
// each component dynamically imports them in onMount, i.e. when its window opens.
import Uienradar from '$lib/projects/Uienradar.svelte';
import Logo3d from '$lib/projects/Logo3d.svelte';
import Ascend from '$lib/projects/Ascend.svelte';
import Scend from '$lib/projects/Scend.svelte';
import PingPong from '$lib/projects/PingPong.svelte';
import Placeholder from '$lib/projects/Placeholder.svelte';

export interface ProjectDef {
	id: string;
	title: string;
	icon: string;
	/** Shown in the "?" About dialog. */
	description: string;
	defaultWidth: number;
	defaultHeight: number;
	defaultX: number;
	defaultY: number;
	/** Rendered inside the window when the project is opened. */
	component: Component;
}

export const projects: ProjectDef[] = [
	{
		id: 'uienradar',
		title: 'Uienradar',
		icon: image_uienradar,
		description:
			'An interactive map of stores selling onions ("uien") near you. Built with Leaflet, marker clustering and a sprinkle of Mapbox tiles.',
		defaultWidth: 800,
		defaultHeight: 500,
		defaultX: 100,
		defaultY: 100,
		component: Uienradar
	},
	{
		id: 'raytracer',
		title: 'Raytracer',
		icon: image_tree,
		description: 'A raytracer experiment. Nothing to see here yet — check back later!',
		defaultWidth: 400,
		defaultHeight: 300,
		defaultX: 140,
		defaultY: 120,
		component: Placeholder
	},
	{
		id: 'blog',
		title: 'Blog',
		icon: image_notepad,
		description: 'Thoughts and write-ups. Nothing published yet — check back later!',
		defaultWidth: 400,
		defaultHeight: 300,
		defaultX: 180,
		defaultY: 140,
		component: Placeholder
	},
	{
		id: 'pingpong',
		title: 'Ping Pong Tracker',
		icon: image_notepad,
		description: 'A tracker for office ping pong matches and rankings. Work in progress!',
		defaultWidth: 400,
		defaultHeight: 300,
		defaultX: 220,
		defaultY: 160,
		component: PingPong
	},
	{
		id: 'logo3d',
		title: 'michaël.com',
		icon: image_connected_world,
		description:
			'A retro 3D logo: spinning metallic text over an endless synthwave grid, rendered with Three.js, pixelated and scanlined for that CRT feel.',
		defaultWidth: 900,
		defaultHeight: 520,
		defaultX: 200,
		defaultY: 100,
		component: Logo3d
	},
	{
		id: 'ascend',
		title: 'Ascend',
		icon: image_climber,
		description:
			'A climbing-horror game prototype. Climb the wall, manage your grip, and don’t look down.',
		defaultWidth: 520,
		defaultHeight: 680,
		defaultX: 260,
		defaultY: 60,
		component: Ascend
	},
	{
		id: 'scend',
		title: 'SCEND',
		icon: image_scend,
		description: 'A climbing game. The successor to Ascend — scale the wall and reach new heights.',
		defaultWidth: 760,
		defaultHeight: 520,
		defaultX: 300,
		defaultY: 120,
		component: Scend
	}
];

export const projectsById: Record<string, ProjectDef> = Object.fromEntries(
	projects.map((p) => [p.id, p])
);
