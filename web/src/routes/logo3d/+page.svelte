<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import Window from '$lib/Window.svelte';

	// Public props
	export let name: string = 'Michaël';
	// Use a Three.js typeface JSON font (convert your TTF via Facetype.js or similar)
	// Ensure this file exists in your static folder, e.g. /static/fonts/Orbitron_Regular.typeface.json
	export let fontJsonUrl: string = '/fonts/Orbitron_Regular.typeface.json';

	export let rotationSpeed: number = 0.35; // radians/sec around Y
	export let pixelRatioMax: number = 2; // clamp for perf
	export let outlineColor: number = 0xff4bd8; // key light color (magenta)
	export let glowColor: number = 0x53ffe4; // rim light color (cyan)

	// Extrusion/bevel controls
	export let size: number = 1.2; // text size in scene units
	export let height: number = 0.4; // extrusion depth
	export let bevelEnabled: boolean = true;
	export let bevelThickness: number = 0.06;
	export let bevelSize: number = 0.03;
	export let bevelSegments: number = 3;
	export let curveSegments: number = 8;

	let mountEl: HTMLDivElement | null = null;

	let renderer: any = null;
	let scene: any = null;
	let camera: any = null;
	let textMesh: any = null;
	let glowMesh: any = null;
	let grid: any = null;
	let rafId: number | null = null;
	let resizeObs: ResizeObserver | null = null;

	let prefersReduced = false;
	if (browser && 'matchMedia' in window) {
		prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	}

	onMount(async () => {
		// Dynamically import Three and examples only in the browser
		const THREE = await import('three');
		const { FontLoader } = await import('three/examples/jsm/loaders/FontLoader.js');
		const { TextGeometry } = await import('three/examples/jsm/geometries/TextGeometry.js');

		if (!mountEl) return;

		const w = mountEl.clientWidth;
		const h = mountEl.clientHeight;

		renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
		renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, pixelRatioMax));
		renderer.setSize(w, h);
		// Optional tone mapping for nicer look
		renderer.outputColorSpace = THREE.SRGBColorSpace;
		mountEl.appendChild(renderer.domElement);

		scene = new THREE.Scene();
		scene.fog = new THREE.Fog(new THREE.Color('#0a0716'), 8, 22);

		camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 100);
		camera.position.set(0, 1.2, 9);
		scene.add(camera);

		// Lights
		const ambient = new THREE.AmbientLight(0x404040, 0.9);
		scene.add(ambient);
		const key = new THREE.DirectionalLight(outlineColor, 1.0);
		key.position.set(2, 3, 5);
		scene.add(key);
		const rim = new THREE.DirectionalLight(glowColor, 0.7);
		rim.position.set(-4, 2, -3);
		scene.add(rim);

		// Background gradient plane
		const bgGeo = new THREE.PlaneGeometry(50, 50);
		const bgMat = new THREE.ShaderMaterial({
			uniforms: {},
			vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
			fragmentShader: `varying vec2 vUv; void main(){ vec3 top = vec3(0.078,0.019,0.137); vec3 mid = vec3(0.039,0.027,0.086); vec3 col = mix(top, mid, vUv.y); gl_FragColor = vec4(col,1.0); }`,
			depthWrite: false
		});
		const bg = new THREE.Mesh(bgGeo, bgMat);
		bg.position.z = -10;
		scene.add(bg);

		// Grid "floor"
		grid = new THREE.GridHelper(30, 30, 0xffffff, 0xffffff);
		// @ts-ignore
		grid.material.opacity = 0.16;
		grid.material.transparent = true;
		// @ts-ignore
		grid.position.y = -1.5;
		grid.rotation.x = Math.PI / 2.8;
		scene.add(grid);

		// Load JSON font and build extruded 3D text
		const loader = new FontLoader();
		let font;
		try {
			font = await new Promise((resolve, reject) =>
				loader.load(fontJsonUrl, resolve, undefined, reject)
			);
		} catch (e) {
			console.error('[logo3d] Failed to load font JSON at', fontJsonUrl, e);
			return;
		}

		const geo = new TextGeometry(name, {
			font,
			size,
			height,
			curveSegments,
			bevelEnabled,
			bevelThickness,
			bevelSize,
			bevelSegments
		});
		// Center the geometry around origin for better rotation
		geo.center();

		const material = new THREE.MeshStandardMaterial({
			color: 0xffffff,
			metalness: 0.6,
			roughness: 0.35
		});
		textMesh = new THREE.Mesh(geo, material);
		textMesh.position.set(0, 0.4, 0);
		scene.add(textMesh);

		// Add a cheap cyan glow shell behind it
		const glowGeo = geo.clone();
		const glowMat = new THREE.MeshBasicMaterial({
			color: glowColor,
			transparent: true,
			opacity: 0.12,
			depthWrite: false,
			blending: THREE.AdditiveBlending
		});
		glowMesh = new THREE.Mesh(glowGeo, glowMat);
		glowMesh.position.copy(textMesh.position);
		glowMesh.scale.multiplyScalar(1.03);
		glowMesh.position.z = -0.03;
		scene.add(glowMesh);

		const start = performance.now();
		const animate = (t: number) => {
			const s = (t - start) / 1000;
			const base = 0.6 + Math.sin(s * 0.6) * 0.05;
			const speed = prefersReduced ? 0 : rotationSpeed;

			if (textMesh) {
				textMesh.rotation.y = s * speed;
				textMesh.rotation.x = Math.sin(s * 0.25) * 0.04;
				textMesh.scale.setScalar(base);
			}
			if (glowMesh) {
				glowMesh.rotation.copy(textMesh.rotation);
				glowMesh.scale.copy(textMesh.scale);
			}
			// @ts-ignore
			grid.material.opacity = 0.16 + 0.02 * Math.sin(s * 1.5);

			renderer.render(scene, camera);
			rafId = requestAnimationFrame(animate);
		};
		rafId = requestAnimationFrame(animate);

		// Resize with container
		resizeObs = new ResizeObserver((entries) => {
			for (const entry of entries) {
				const cr = entry.contentRect;
				renderer.setSize(cr.width, cr.height);
				camera.aspect = cr.width / cr.height;
				camera.updateProjectionMatrix();
			}
		});
		resizeObs.observe(mountEl);
	});

	onDestroy(() => {
		// Guard for SSR: cancelAnimationFrame/window not present on the server
		if (browser && rafId !== null && typeof window !== 'undefined' && window.cancelAnimationFrame) {
			window.cancelAnimationFrame(rafId);
			rafId = null;
		}
		if (resizeObs && mountEl) resizeObs.unobserve(mountEl);
		if (renderer) {
			renderer.dispose();
			const el = renderer.domElement;
			if (el && el.parentNode) el.parentNode.removeChild(el);
		}
		textMesh = glowMesh = grid = null;
		scene = camera = renderer = null;
	});
</script>

<Window title="Logo" initialWidth={900} initialHeight={520} initialX={120} initialY={120}>
	<div class="canvas-wrap" bind:this={mountEl}></div>
</Window>

<style>
	.canvas-wrap {
		position: relative;
		width: 100%;
		aspect-ratio: 16/9;
		border-radius: 24px;
		overflow: hidden;
		box-shadow:
			0 20px 60px rgba(0, 0, 0, 0.5),
			inset 0 0 0 1px rgba(255, 255, 255, 0.07);
		background:
			radial-gradient(
				800px 500px at 50% 30%,
				color-mix(in hsl, var(--vapor-sun, #ffb86b) 30%, transparent),
				transparent 60%
			),
			linear-gradient(180deg, #140423, #0a0716 65%);
	}
</style>
