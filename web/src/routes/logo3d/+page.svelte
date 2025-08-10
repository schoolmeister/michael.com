<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import Window from '$lib/Window.svelte';
	import xpBg from '$lib/images/windows-xp.jpg';

	// Public props
	export let name: string = 'michaël.com';
	export let rotationSpeed: number = 0.6; // base spin speed (radians/sec factor)
	export let pixelScale: number = 0.5; // 0.3..0.7 — lower = more pixelated
	export let skyColor: number = 0x0b2d8f; // clear dark blue sky
	export let enableColorCycle: boolean = true; // toggle hue shifting
	export let enableScanlines: boolean = true; // show horizontal scanlines overlay
	export let enableVignette: boolean = true; // darken edges for CRT feel
	export let gridScrollSpeed: number = 2.5; // speed factor for scrolling grid
	export let gridDensity: number = 170; // number of cells across (higher = smaller cells)
	export let gridLineThickness: number = 0.15; // visual thickness factor (smaller = thinner lines)
	export let particleSpeed: number = 6; // units per second particles move toward camera
	export let enableClouds: boolean = false; // toggle low-poly clouds
	export let cloudElongationX: number = 2.0; // horizontal stretch factor for clouds
	export let cloudElongationZ: number = 1.0; // depth stretch factor for clouds
	export let cloudEmissiveIntensity: number = 0.25; // extra glow to make them really white
	export let cloudNoiseAmp: number = 0.08; // vertex noise amplitude to soften cloud silhouette
	// Background
	export let enableXPBackground: boolean = true; // toggle Windows XP hill backdrop

	// Metallic text tuning props
	export let metalRoughness: number = 0.18; // lower = sharper reflections
	export let metalEnvIntensity: number = 1.25; // environment reflection intensity
	export let metalClearcoat: number = 1.0; // clearcoat layer strength
	export let metalClearcoatRoughness: number = 0.08; // clearcoat micro roughness
	export let enableRimLight: boolean = true; // extra back rim light for depth
	// Extra specular point light
	export let enableSpecularLight: boolean = true; // toggle moving highlight light
	export let specularLightIntensity: number = 0.9; // intensity of moving point light
	export let sunZ: number = -50; // depth position for sun behind clouds
	export let sunY: number = 6.0; // vertical position (raised above clouds)
	// Sun billboard removed (keeping only back light)

	// Text geometry settings (low-poly)
	export let fontJsonUrl: string = '/fonts/Fixedsys Excelsior 3.01_Regular.json';
	export let size: number = 1.3;
	export let depth: number = 1;
	export let curveSegments: number = 3;
	export let bevelEnabled: boolean = false;

	let mountEl: HTMLDivElement | null = null;

	// Three.js objects (typed loosely for brevity)
	let renderer: any,
		scene: any,
		camera: any,
		controls: any,
		pmremGen: any,
		rimLight: any,
		accentLight: any,
		specLight: any;
	let xpTexture: any;
	let textMesh: any, outlineMesh: any, grid: any; // grid will be a shader plane now
	let gridMat: any;
	let floatingObjects: any[] = [];
	let particles: any;
	let particlePositions: Float32Array | null = null;
	let particleCount = 0;
	let lastTime = 0;
	let _tmpVec: any; // reused temp vector for particle calculations
	let clouds: any[] = [];
	let rafId: number | null = null;
	let resizeObs: ResizeObserver | null = null;
	let prefersReduced = false;

	if (browser && 'matchMedia' in window) {
		prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	}

	// Update shader uniforms if user changes props at runtime
	$: if (gridMat) {
		gridMat.uniforms.density.value = gridDensity;
		gridMat.uniforms.thickness.value = gridLineThickness;
		gridMat.uniforms.speed.value = gridScrollSpeed;
	}

	onMount(async () => {
		const THREE = await import('three');
		const { FontLoader } = await import('three/examples/jsm/loaders/FontLoader.js');
		const { TextGeometry } = await import('three/examples/jsm/geometries/TextGeometry.js');
		const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');
		const { RoomEnvironment } = await import('three/examples/jsm/environments/RoomEnvironment.js');

		if (!mountEl) return;

		// Renderer (pixelated upscale)
		renderer = new THREE.WebGLRenderer({
			antialias: false,
			alpha: false,
			powerPreference: 'low-power'
		});
		renderer.setClearColor(skyColor, 1);
		renderer.outputColorSpace = THREE.SRGBColorSpace;
		renderer.domElement.style.imageRendering = 'pixelated';
		mountEl.appendChild(renderer.domElement);

		// Scene & camera
		scene = new THREE.Scene();
		camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
		camera.position.set(0, 0.6, 5);
		camera.lookAt(0, 0, 0);
		scene.add(camera);

		// Optional Windows XP background
		if (enableXPBackground) {
			xpTexture = new THREE.TextureLoader().load(xpBg, () => {
				xpTexture.colorSpace = THREE.SRGBColorSpace;
				scene.background = xpTexture;
			});
		} else {
			scene.background = null; // retain clear color
		}

		// Lighting (simple retro style)
		scene.add(new THREE.AmbientLight(0x506090, 0.55));
		const key = new THREE.DirectionalLight(0xffffff, 0.9);
		key.position.set(2, 3, 5);
		scene.add(key);
		const fill = new THREE.DirectionalLight(0x88aaff, 0.35);
		fill.position.set(-3, 2, -2);
		scene.add(fill);

		// Animated infinite scrolling grid (shader plane)
		const gridSize = 400; // large to cover view
		const gridGeom = new THREE.PlaneGeometry(gridSize, gridSize, 1, 1);
		gridMat = new THREE.ShaderMaterial({
			transparent: true,
			uniforms: {
				uTime: { value: 0 },
				uColor: { value: new THREE.Color(0x00afff) },
				speed: { value: gridScrollSpeed },
				density: { value: gridDensity },
				thickness: { value: gridLineThickness }
			},
			vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv=uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
			fragmentShader: /* glsl */ `precision highp float; varying vec2 vUv; uniform float uTime; uniform vec3 uColor; uniform float speed; uniform float density; uniform float thickness; 
			void main(){
				// Scale UV for density (more density => smaller cells)
				vec2 uv = vUv * density;
				uv.y += uTime * speed * 0.6; // scrolling
				float gx = abs(fract(uv.x) - 0.5);
				float gy = abs(fract(uv.y) - 0.5);
				float distToLine = min(gx, gy);
				// Convert thickness (approx) into smooth band around 0.5 center lines
				float w = thickness * 0.5; // inner half-width
				float line = smoothstep(0.5 - w, 0.5 - w * 0.2, 0.5 - distToLine);
				float fade = smoothstep(0.0, 1.0, 1.0 - vUv.y);
				float alpha = line * fade * 0.5; 
				if(alpha < 0.01) discard;
				gl_FragColor = vec4(uColor, alpha);
			}`
		});
		grid = new THREE.Mesh(gridGeom, gridMat);
		grid.rotation.x = -Math.PI / 2.0; // lay flat on XZ
		grid.position.y = -1.2;
		scene.add(grid);

		// Setup environment for metallic reflections
		pmremGen = new THREE.PMREMGenerator(renderer);
		pmremGen.compileEquirectangularShader();
		const envTex = pmremGen.fromScene(new RoomEnvironment(), 0.04).texture;
		scene.environment = envTex;

		// Load font & build text
		const font: any = await new Promise((res, rej) =>
			new FontLoader().load(fontJsonUrl, res, undefined, rej)
		);
		// TextGeometry uses 'depth' not 'height' in current three typings
		const geo = new TextGeometry(name, { font, size, depth, curveSegments, bevelEnabled });
		geo.center();
		// Metallic material (physical for clearer highlights)
		const mat = new THREE.MeshPhysicalMaterial({
			color: 0xff0000,
			dithering: true,
			metalness: 1.0,
			roughness: metalRoughness,
			envMapIntensity: metalEnvIntensity,
			clearcoat: metalClearcoat,
			clearcoatRoughness: metalClearcoatRoughness,
			sheen: 1,
			reflectivity: 1
		});
		textMesh = new THREE.Mesh(geo, mat);
		textMesh.scale.multiplyScalar(0.25);
		scene.add(textMesh);
		// Outline (slightly expanded back-side mesh)
		outlineMesh = new THREE.Mesh(
			geo.clone(),
			new THREE.MeshBasicMaterial({ color: 0x00afff, side: THREE.BackSide })
		);
		outlineMesh.scale.multiplyScalar(0.26);
		scene.add(outlineMesh);

		// Extra lights to enhance metal depth
		if (enableRimLight) {
			rimLight = new THREE.DirectionalLight(0xffffff, 0.55);
			rimLight.position.set(0, 1.5, -4); // behind text
			scene.add(rimLight);
			accentLight = new THREE.PointLight(0x88bbff, 0.4, 15, 1.5);
			accentLight.position.set(-3, 2.2, 3);
			scene.add(accentLight);
		}

		if (enableSpecularLight) {
			// Sun-like back light: place behind clouds along -Z (brighter & higher)
			specLight = new THREE.PointLight(0xfff7dc, specularLightIntensity * 2.2, 160, 2.8);
			specLight.position.set(-8, sunY, sunZ);
			scene.add(specLight);
			// No visible sun sprite
		}

		// Orbit controls
		controls = new OrbitControls(camera, renderer.domElement);
		controls.enableDamping = true;
		controls.dampingFactor = 0.06;
		controls.minDistance = 2;
		controls.maxDistance = 30;
		controls.maxPolarAngle = Math.PI / 2;

		// Retro floating primitives
		const retroColors = [0xff6b9d, 0x4ecdc4, 0x45b7d1, 0x96ceb4, 0xffd93d, 0xff6b6b];
		const addFloaty = (mesh: any, idx: number) => {
			mesh.userData = {
				baseY: mesh.position.y,
				f: 0.3 + Math.random() * 0.5,
				r: 0.3 + Math.random() * 0.7,
				idx
			};
			floatingObjects.push(mesh);
			scene.add(mesh);
		};

		// Clouds quick-win: merge parts, add vertex noise + gradient + subtle rim to reduce boxy look
		if (enableClouds) {
			// Import geometry utils (module exports functions rather than namespace constant in typings)
			const BufferGeometryUtils = await import('three/examples/jsm/utils/BufferGeometryUtils.js');
			const hash = (x: number, y: number, z: number) => {
				return (Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453) % 1; // pseudo noise
			};
			const makeCloud = (cx: number, cy: number, cz: number, scale = 1) => {
				const partGeos: any[] = [];
				const parts = 6 + Math.floor(Math.random() * 4);
				for (let i = 0; i < parts; i++) {
					const r = 0.45 + Math.random() * 0.5;
					const g = new THREE.IcosahedronGeometry(r, 0);
					const px = (Math.random() - 0.5) * 2.4 * cloudElongationX;
					const py = (Math.random() - 0.5) * 0.5;
					const pz = (Math.random() - 0.5) * 1.2 * cloudElongationZ;
					g.translate(px, py, pz);
					partGeos.push(g);
				}
				let merged = (BufferGeometryUtils as any).mergeGeometries(partGeos, false);
				// Vertex noise + color gradient
				const posAttr = merged.getAttribute('position');
				for (let i = 0; i < posAttr.count; i++) {
					const x = posAttr.getX(i);
					const y = posAttr.getY(i);
					const z = posAttr.getZ(i);
					const n = (hash(x, y, z) + hash(y, z, x) + hash(z, x, y)) / 3.0; // 0..1
					const nx = (n - 0.5) * cloudNoiseAmp;
					const ny = (n - 0.5) * cloudNoiseAmp * 0.6; // less vertical distortion
					const nz = (n - 0.5) * cloudNoiseAmp;
					posAttr.setXYZ(i, x + nx, y + ny, z + nz);
				}
				posAttr.needsUpdate = true;
				merged.computeVertexNormals();
				// Compute gradient after noise
				let minY = Infinity,
					maxY = -Infinity;
				for (let i = 0; i < posAttr.count; i++) {
					const y = posAttr.getY(i);
					if (y < minY) minY = y;
					if (y > maxY) maxY = y;
				}
				const colors = new Float32Array(posAttr.count * 3);
				for (let i = 0; i < posAttr.count; i++) {
					// Make nearly pure white, slight dim toward bottom only (avoid grey cast)
					const y = posAttr.getY(i);
					const t = (y - minY) / (maxY - minY + 1e-5);
					const shade = 1.0 - 0.015 * (1.0 - t); // 1 at top, 0.985 bottom
					colors[i * 3] = shade;
					colors[i * 3 + 1] = shade;
					colors[i * 3 + 2] = shade;
				}
				merged.setAttribute('color', new THREE.BufferAttribute(colors, 3));
				const cloudMat = new THREE.MeshLambertMaterial({
					vertexColors: true,
					dithering: true,
					flatShading: true,
					emissive: 0xffffff,
					emissiveIntensity: cloudEmissiveIntensity * 1.2 // boost whiteness
				});
				const mesh = new THREE.Mesh(merged, cloudMat);
				mesh.scale.set(scale * cloudElongationX, scale * 0.9, scale * cloudElongationZ);
				mesh.position.set(cx, cy, cz);
				// Simple rim (backside enlarged copy)
				const rim = new THREE.Mesh(
					merged.clone(),
					new THREE.MeshBasicMaterial({
						color: 0xffffff,
						transparent: true,
						opacity: 0.35,
						depthWrite: false,
						side: THREE.BackSide
					})
				);
				rim.scale.copy(mesh.scale).multiplyScalar(1.04);
				rim.position.copy(mesh.position);
				const container = new THREE.Group();
				container.add(mesh);
				container.add(rim);
				container.userData = {
					drift: new THREE.Vector3(0.15 + Math.random() * 0.15, 0, 0.04 + Math.random() * 0.04),
					baseY: cy,
					bobAmp: 0.18 + Math.random() * 0.08,
					bobFreq: 0.25 + Math.random() * 0.15
				};
				scene.add(container);
				clouds.push(container);
			};
			makeCloud(-6, 2.2, -18, 2.3);
			makeCloud(5, 1.9, -28, 2.9);
			makeCloud(-1.5, 2.7, -38, 3.4);
		}

		// Starfield particles
		const starGeom = new THREE.BufferGeometry();
		const starCount = 220;
		const pos = new Float32Array(starCount * 3);
		for (let i = 0; i < pos.length; i += 3) {
			// Spawn mostly far away in camera view direction (negative Z region)
			pos[i] = (Math.random() - 0.5) * 60; // x spread
			pos[i + 1] = (Math.random() - 0.5) * 30; // y spread
			pos[i + 2] = -20 - Math.random() * 60; // z in [-80,-20] (farther than text at ~0)
		}
		starGeom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
		particles = new THREE.Points(
			starGeom,
			new THREE.PointsMaterial({ color: 0xffffff, size: 0.05, sizeAttenuation: true })
		);
		particlePositions = pos;
		particleCount = starCount;
		scene.add(particles);

		// Animation loop
		const animate = (t: number) => {
			const s = t / 1000;
			const dt = lastTime ? (t - lastTime) / 1000 : 0; // seconds
			lastTime = t;
			const spin = prefersReduced ? 0 : rotationSpeed;
			// Rotate text around Y so width stays readable
			textMesh.rotation.y = s * spin;
			outlineMesh.rotation.y = textMesh.rotation.y;

			if (enableColorCycle && !prefersReduced) {
				const hue = (s * 0.08) % 1;
				(textMesh.material as any).color.setHSL(hue, 0.25, 0.85);
			}

			// Float & rotate primitives
			floatingObjects.forEach((o) => {
				o.rotation.x += o.userData.r * 0.01;
				o.rotation.y += o.userData.r * 0.015;
				o.position.y = o.userData.baseY + Math.sin(s * o.userData.f + o.userData.idx) * 0.35;
			});

			// Drift clouds slowly & bob
			if (clouds.length) {
				clouds.forEach((c) => {
					c.position.addScaledVector(c.userData.drift, dt * 0.2); // slow drift
					c.position.y = c.userData.baseY + Math.sin(s * c.userData.bobFreq) * c.userData.bobAmp;
					// wrap clouds when far to the side to create endless drift
					if (c.position.x > 10) c.position.x = -10;
					if (c.position.x < -10) c.position.x = 10;
				});
			}

			if (particles) {
				particles.rotation.y = s * 0.04;
				if (particlePositions) {
					if (!_tmpVec) {
						// const , = await import('three');
						_tmpVec = new THREE.Vector3();
					}
					const camX = camera.position.x;
					const camY = camera.position.y;
					const camZ = camera.position.z;
					for (let i = 0; i < particleCount; i++) {
						const base = i * 3;
						const px = particlePositions[base];
						const py = particlePositions[base + 1];
						const pz = particlePositions[base + 2];
						let dx = camX - px;
						let dy = camY - py;
						let dz = camZ - pz;
						const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.0001;
						// Normalize toward camera
						dx /= dist;
						dy /= dist;
						dz /= dist;
						particlePositions[base] += dx * particleSpeed * dt;
						particlePositions[base + 1] += dy * particleSpeed * dt;
						particlePositions[base + 2] += dz * particleSpeed * dt;
						// Respawn when very close to camera
						if (dist < 1.0) {
							// Place far away along inverse camera direction plus jitter
							particlePositions[base] = (Math.random() - 0.5) * 60;
							particlePositions[base + 1] = (Math.random() - 0.5) * 30;
							particlePositions[base + 2] = -20 - Math.random() * 60;
						}
					}
					(particles.geometry.attributes.position as any).needsUpdate = true;
				}
			}

			controls.update();
			// Face sun billboard toward camera
			// (Sun billboard removed)
			// Update grid time uniform for scrolling effect
			if (gridMat) gridMat.uniforms.uTime.value = s;
			renderer.render(scene, camera);
			rafId = requestAnimationFrame(animate);
		};
		rafId = requestAnimationFrame(animate);

		// Responsive pixel scaling
		const setSize = () => {
			if (!mountEl) return;
			const w = mountEl.clientWidth,
				h = mountEl.clientHeight;
			const rw = Math.max(1, Math.floor(w * pixelScale));
			const rh = Math.max(1, Math.floor(h * pixelScale));
			renderer.setSize(rw, rh, false);
			renderer.domElement.style.width = w + 'px';
			renderer.domElement.style.height = h + 'px';
			camera.aspect = w / h;
			camera.updateProjectionMatrix();
		};
		setSize();
		resizeObs = new ResizeObserver(setSize);
		resizeObs.observe(mountEl);
	});

	onDestroy(() => {
		xpTexture?.dispose?.();
		if (browser && rafId !== null && typeof window !== 'undefined') {
			cancelAnimationFrame(rafId);
		}
		if (resizeObs && mountEl) resizeObs.unobserve(mountEl);
		controls?.dispose();
		// Dispose resources
		floatingObjects.forEach((o) => {
			o.geometry?.dispose?.();
			o.material?.dispose?.();
		});
		if (textMesh) {
			textMesh.geometry?.dispose?.();
			textMesh.material?.dispose?.();
		}
		if (outlineMesh) {
			outlineMesh.geometry?.dispose?.();
			outlineMesh.material?.dispose?.();
		}
		if (grid) {
			grid.geometry?.dispose?.();
			gridMat?.dispose?.();
		}
		// Dispose clouds
		clouds.forEach((cl) => {
			cl.traverse((child: any) => {
				if (child.isMesh) {
					child.geometry?.dispose?.();
					child.material?.dispose?.();
				}
			});
		});
		particles?.geometry?.dispose?.();
		particles?.material?.dispose?.();
		if (rimLight) scene.remove(rimLight);
		if (accentLight) scene.remove(accentLight);
		pmremGen?.dispose?.();
		renderer?.dispose();
		const el = renderer?.domElement;
		if (el && el.parentNode) el.parentNode.removeChild(el);
		renderer = scene = camera = controls = textMesh = outlineMesh = grid = particles = null;
		floatingObjects = [];
	});
</script>

<Window title="michaël.com" initialWidth={900} initialHeight={520} initialX={200} initialY={100}>
	<div class="canvas-wrap" bind:this={mountEl}>
		{#if enableScanlines || enableVignette}
			<div
				class="crt-overlay {enableScanlines ? 'scanlines' : ''} {enableVignette ? 'vignette' : ''}"
			></div>
		{/if}
	</div>
</Window>

<style>
	.canvas-wrap {
		position: relative;
		width: 100%;
		aspect-ratio: 16/9;
		border-radius: 24px;
		overflow: hidden;
		/* Remove gradient background so Three.js sky shows clearly */
		background: none;
		box-shadow:
			0 20px 60px rgba(0, 0, 0, 0.5),
			inset 0 0 0 1px rgba(255, 255, 255, 0.07);
	}

	.crt-overlay {
		pointer-events: none;
		position: absolute;
		inset: 0;
		mix-blend-mode: overlay;
		animation: crt-flicker 4s steps(60) infinite;
		opacity: 0.9;
	}

	.crt-overlay.scanlines {
		background-image: repeating-linear-gradient(
			to bottom,
			rgba(255, 255, 255, 0.065) 0px,
			rgba(255, 255, 255, 0.065) 1px,
			rgba(0, 0, 0, 0) 2px,
			rgba(0, 0, 0, 0) 3px
		);
		background-size: 100% 3px;
	}

	.crt-overlay.vignette {
		/* Radial darkening toward edges */
		box-shadow:
			inset 0 0 100px 40px rgba(0, 0, 0, 0.55),
			inset 0 0 40px 10px rgba(0, 0, 0, 0.4);
		border-radius: inherit;
	}

	@keyframes crt-flicker {
		0%,
		100% {
			opacity: 0.9;
		}
		50% {
			opacity: 0.92;
		}
		60% {
			opacity: 0.88;
		}
		70% {
			opacity: 0.91;
		}
	}
</style>
