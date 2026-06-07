# SCEND Platform Tileset Template

A fixed grid the artist paints art INTO. Because the layout never changes, every theme reuses
the same source-rect coordinates — no more guessing where a tile lives. Paint a copy of the
template, export a PNG at the same size, point a theme at it. Done.

## Grid spec

- **Cell size:** `64 × 64` px (constant `TEMPLATE_TILE` in `src/themes.ts`).
- **Grid:** 5 columns × 3 rows.
- **Sheet size:** `320 × 192` px.
- **Source rect of cell (col,row):** `(col*64, row*64, 64, 64)` — see `cell()` / `SLOTS` in `themes.ts`.
- The game scales each 64px source cell down to the 44px gameplay tile (`C.TILE`) via `blitTile`.
  Paint at 64px for detail; it downscales cleanly.

Files:
- `assets-template/tileset-template.svg` — editable, precise source of the labeled guide.
- `public/assets/tileset-template.png` — rasterized 320×192 PNG the game loads as the default theme.

## Cells

| Slot (Theme field) | Cell (c,r) | Pixel rect (sx,sy,sw,sh) | What art belongs here | How the game uses it | Tiling |
|---|---|---|---|---|---|
| `surfLeft`    | (0,0) | 0,0,64,64     | Walkable top, left end-cap (rounded/finished left corner) | First column of a run ≥2 wide | cap |
| `surfMid`     | (1,0) | 64,0,64,64    | Walkable top, seamless middle | Every interior column of a run | repeat |
| `surfRight`   | (2,0) | 128,0,64,64   | Walkable top, right end-cap | Last column of a run ≥2 wide | cap |
| `surfSingle`  | (3,0) | 192,0,64,64   | Walkable top, both ends capped (1-wide slab) | Platforms exactly 1 tile wide | single |
| `surfMidAlt`  | (4,0) | 256,0,64,64   | Alternate middle for visual variety (cracks, moss) | Not wired yet — swap into mid for variety later | repeat |
| `underLeft`   | (0,1) | 0,64,64,64    | Slab underside, left edge (visible bottom-left corner) | Drawn beneath `surfLeft` | cap |
| `underMid`    | (1,1) | 64,64,64,64   | Slab underside, seamless middle | Beneath interior columns | repeat |
| `underRight`  | (2,1) | 128,64,64,64  | Slab underside, right edge | Beneath `surfRight` | cap |
| `underSingle` | (3,1) | 192,64,64,64  | Slab underside for a 1-wide slab | Beneath `surfSingle` | single |
| `hangDetail`  | (4,1) | 256,64,64,64  | Drips / chains / roots hanging below | Not wired yet — future decoration | repeat |
| `spike`       | (0,2) | 0,128,64,64   | Spike hazard | Not wired — hazards still drawn as neon vectors in `render.ts` | n/a |
| `lavaTop`     | (1,2) | 64,128,64,64  | Lava surface | Future hazard theming | n/a |
| `geyserVent`  | (2,2) | 128,128,64,64 | Geyser vent mouth | Future hazard theming | n/a |
| `corner`      | (3,2) | 192,128,64,64 | Decorative corner piece | Future decor | n/a |
| `accent`      | (4,2) | 256,128,64,64 | Free accent / sign / banner | Future decor | n/a |

### Tiling rules the game applies (see `drawPlatforms` in `src/render.ts`)
A platform is a horizontal run of N tiles on one of 3 floors, floating over the abyss:
- **N == 1** → `surfSingle` over `underSingle`.
- **N >= 2** → first column `surfLeft`/`underLeft`, last column `surfRight`/`underRight`, every
  column between repeats `surfMid`/`underMid`.
- The underside row is drawn directly below the surface (`top + C.TILE`) so the bottom edge of
  the floating slab reads against the black abyss.
- While the image is still loading (`sprite.ready === false`) the game falls back to the original
  neon slab so nothing renders blank. Neon hazard overlays (spike/lava/geyser) are always drawn
  on top.

## Authoring a new theme

1. Open `tileset-template.svg` (or the PNG) and paint your art into each cell, keeping the exact
   layout. Stay inside the cell boundaries. Make the SURFACE row edges tile-able where marked
   `repeat`, and finish the `*-left` / `*-right` / `*-single` caps as real edges.
2. Export a **320 × 192 PNG** to `scend/public/assets/<theme>.png`.
3. Register it in `src/themes.ts`:
   ```ts
   THEMES.cathedral = templateTheme('cathedral', 'assets/cathedral.png');
   ```
   `templateTheme` reuses the fixed `SLOTS` rects — you only supply the name + image path.
4. Use it: call `setTheme('cathedral')`. The default theme is `'template'`, which loads the
   labeled guide itself so you can confirm the mapping renders correctly in-game.

Asset paths are **relative** (`assets/NAME.png`, no leading slash) — absolute paths 404 in the
production build.

## Re-rasterizing the SVG to PNG

This repo was built with `rsvg-convert` (Homebrew `librsvg`):

```sh
rsvg-convert -w 320 -h 192 \
  scend/assets-template/tileset-template.svg \
  -o scend/public/assets/tileset-template.png
```

Alternatives if `rsvg-convert` is unavailable: `inkscape --export-type=png -w 320 -h 192 ...`,
`magick -background none -density ... template.svg -resize 320x192 template.png`, `cairosvg
template.svg -W 320 -H 192 -o template.png`, or open the SVG in any vector editor and export at
320×192. Always keep the output exactly 320×192 so cell coords stay `(c*64, r*64)`.
