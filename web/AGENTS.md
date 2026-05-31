# Repository Guidelines

## Project Structure & Module Organization
- `src/routes/`: SvelteKit routes (e.g., `uienradar`, `logo`, `pingpong`). Use `+page.svelte` and `+page.server.ts` for server-only data.
- `src/lib/`: Reusable UI and helpers (e.g., `Window.svelte`, `Icon.svelte`, `data/`, `images/`).
- `static/`: Public assets served at root (e.g., `/favicon.png`, `/fonts`).
- `netlify/` and `netlify.toml`: Functions and deploy configuration.
- `.svelte-kit/`: Generated; do not edit or commit.

## Build, Test, and Development Commands
- `npm run dev`: Start local dev server (Vite + SvelteKit).
- `npm run build`: Production build (adapter targets Netlify per `netlify.toml`).
- `npm run preview`: Serve the built app locally for smoke testing.
- `npm run check`: Type + Svelte checks (run before PRs).
- `npm run lint`: Prettier check then ESLint.
- `npm run format`: Apply Prettier formatting.

## Coding Style & Naming Conventions
- Formatting: Prettier (tabs, single quotes, width 100). Run `npm run format`.
- Linting: ESLint with TypeScript + Svelte rules; fix warnings before merging.
- TypeScript: `strict` enabled; avoid `any`. Prefer explicit interfaces.
- Components: PascalCase (`Window.svelte`). Route folders: kebab-case (`my-feature`).
- SvelteKit files: `+page.svelte`, `+page.ts`, `+page.server.ts` as appropriate.

## Testing Guidelines
- No unit test suite configured. Use `npm run check` and `npm run lint` for validation.
- For new tests, prefer Vitest colocated under `src/` as `*.test.ts`. Keep fast and deterministic.
- Use `npm run preview` for manual verification of routes and Netlify functions.

## Commit & Pull Request Guidelines
- Commits: Short, imperative subject lines (e.g., "add uienradar filters"). Scope optional.
- PRs: Include what/why, linked issues, and screenshots/GIFs for UI changes.
- Before opening a PR: run `npm run check` and `npm run lint`; note any new routes or Netlify functions.

## Security & Configuration Tips
- Load large/static data server-side in `+page.server.ts` (e.g., `src/lib/data/stores.json`). Do not import large JSON directly in client components.
- Keep secrets server-only; use Netlify environment variables. Avoid exposing tokens in client code.
- Browser-only heavy libs (Leaflet/Three): import inside `onMount` and guard with `browser`.

## Architecture Notes
- Desktop-style UI using 98.css; feature pages render inside `<Window>` components. Reuse `Window.svelte` and related drag utilities for new apps.
