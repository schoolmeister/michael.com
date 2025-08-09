# AI Coding Agent Instructions

Concise, project-specific guidance to be productive quickly. Keep changes small and aligned with existing patterns.

## 1. Project Overview

- Stack: SvelteKit (TS, Vite) targeting Netlify. UI styled with 98.css to mimic Windows 98 desktop metaphors (icons + draggable windows).
- Desktop metaphor: `src/routes/+layout.svelte` renders icon grid and a window slot area; feature apps (e.g. `uienradar`, `pingpong`) mount inside draggable `Window` components.
- Data-heavy map feature: `uienradar` page loads a massive GeoJSON (`stores.json`, ~67k lines) server-side via `+page.server.ts` to avoid bundling into client code directly.
- Netlify Functions (`netlify/functions/*.tsx`) provide simple key/value status storage using `@netlify/blobs`.

## 2. Key Directories / Files

- `src/lib/Window.svelte`, `Repositionable.svelte`, `DragController.svelte`: Custom draggable window system. Reuse this trio for any new app window.
- `src/lib/Icon.svelte`: Desktop icon (image + title + link). Add new feature entry points by adding an `<Icon>` in `+layout.svelte`.
- `src/routes/*`: SvelteKit route structure. Use `+page.server.ts` for server-only data loading (e.g. large JSON, secrets) and `+page.svelte` for UI.
- `src/lib/data/stores.json`: Large GeoJSON loaded server-side. Avoid importing this directly in client-only components.
- `netlify/functions/getStatus.tsx` & `setStatus.tsx`: Minimal REST-like endpoints for a single `status` string with validation.
- `netlify.toml`: Build command (`npm run build`) & publish directory (`build`). If switching adapters, update this.

## 3. Build / Dev / Quality Commands

- Dev server: `npm run dev` (Vite + SvelteKit).
- Production build: `npm run build`; preview with `npm run preview`.
- Type & Svelte check: `npm run check` (run before committing new TS / Svelte logic).
- Lint & format check: `npm run lint`; auto-fix formatting: `npm run format`.

## 4. Architectural Patterns

- Separation of concerns: Window mechanics encapsulated in lib components; feature pages only worry about their contents inside `<Window>`.
- Progressive / dynamic imports: Heavy Leaflet ecosystem & CSS imported inside `uienradar/+page.svelte` and gated by `browser` guard + `onMount`.
- Server-side data load: Use `+page.server.ts` to supply large or sensitive data via props, preserving client bundle size.
- Minimal global state: Currently no custom stores; prefer passing data through SvelteKit load until a concrete shared state need appears.

## 5. Adding a New Desktop App (Example Flow)

1. Create route folder: `src/routes/myfeature/+page.svelte` (and optional `+page.server.ts`).
2. Wrap UI in `<Window title="My Feature"> ... </Window>`.
3. Add an icon import & `<Icon image={someImage} name="My Feature" href="myfeature" />` in `+layout.svelte`.
4. If large/static data: put JSON under `src/lib/data/` and load via `+page.server.ts` returning a minimal shape.
5. Validate types: export an interface and narrow data before returning from `load()`.

## 6. Netlify Function Conventions

- Use `getStore('toqua')` for accessing blob storage; keep key namespace small and explicit (`status`).
- Input validation lives inside the function (see `setStatus.tsx` regex & length guards). Mirror style when adding new keys.
- Return `Response` objects directly; prefer simple text or JSON (`new Response(JSON.stringify(obj), { headers: { 'content-type': 'application/json' } })`).

## 7. Performance / Safety Notes

- Avoid re-render churn in drag logic: current approach mutates style directly; keep it (don’t refactor to reactive stores unless needed).
- Large GeoJSON: Never embed directly client-side outside server load. If you need filtering, do it server-side before returning.
- Map tokens: Hardcoded Mapbox token present; if externalizing secrets later, move to environment variables and access only server-side.

## 8. Styling / UI Conventions

- Leverage 98.css classes (e.g. `title-bar`, `title-bar-text`, `window-body`). Keep custom styles minimal and scoped inside components.
- Icon labels use small caps (8pt) with MS Sans Serif fallbacks; replicate style by reusing `<Icon>`.
- Desktop background configured in `+layout.svelte` via inline CSS referencing `$lib/images/windows-xp.jpg`.

## 9. TypeScript & Linting

- Strict TS enabled. Add or refine interfaces instead of using `any`.
- Svelte components use `<script lang="ts">`; keep exported props explicitly typed.
- When exposing utility functions from components (e.g. `updateWindowPosition`), keep return types explicit for discoverability.

## 10. Adding Dependencies

- Prefer devDeps for tooling (`eslint`, `svelte-check`), runtime deps only when code imports them in production.
- After adding a dependency, ensure `import` statements are tree-shake friendly; lazy-load heavy browser-only libs inside `onMount`.

## 11. Testing / Validation Approach

- No formal test suite yet; rely on `npm run check` and lint. If introducing tests, colocate under `src/` and keep lightweight (e.g. vitest) — document in this file.

## 12. When Unsure

- Mirror existing file patterns verbatim (naming, folder placement, server/client separation).
- Prefer least invasive change; small, composable components.
- Ask for clarification if a feature would introduce global state, authentication, or backend persistence beyond current Netlify blobs scope.

---

Provide a brief change summary in PR descriptions (what + why + any route/function additions). Ask maintainers before restructuring core window/drag system.
