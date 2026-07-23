# Air Gallery Challenge

A performance-first rebuild of Air's gallery view: board cards + an
interlocking, virtualized wall of images and videos, with drag-and-drop,
rubber-band selection, and Air-style menus.

**Live:** _deploy link here_ · **Reference:** [public board](https://app.air.inc/a/bDkBvnzpB/b/c74bbbc8-602b-4c88-be71-9e21b36b0514)

## Running locally

```bash
npm i
npm run dev
# open http://localhost:3000
```

## What's built

- **Boards + Assets in collapsible sections**, matching the reference
  gallery: Air-style board cards (thumbnail, gradient, white title) and a
  justified asset wall. Clicking a board card expands an inline panel with
  that board's own assets (fetched lazily, per board).
- **Infinite scroll** via cursor pagination — the virtualizer prefetches the
  next page as you approach the end of what's loaded.
- **Drag to reorder** assets within the wall (dnd-kit, 8px activation so
  clicks and drags never fight).
- **Drag to move** assets onto a board card — works for multi-selections
  too: drag any selected tile and the whole selection moves, with a count
  badge on the drag preview.
- **Rubber-band selection** (`react-drag-to-select`), plus **Shift+drag
  starting on a tile** to lasso from anywhere (see UX notes), shift+click
  range select, cmd/ctrl+click toggle, Esc to clear.
- **Ellipsis + right-click menus** on every asset and board (Radix), with
  the same actions as the reference site (Open, Share a link, Copy to Air
  workspace, Download). When a multi-selection is active the menu reflects
  the selection count and acts on all selected items.
- **Air-style selection bar** pinned to the bottom: ✕, "N items selected
  from …", overflow menu, and Download all.
- **Video hover previews** — hover a video tile briefly and a real preview
  plays (see performance notes).
- **Hover info overlay** on tiles: name, `EXT · size · W × H`.

## Performance notes (the interesting part)

The brief says 500+ assets under 6x CPU throttle, so every decision below
optimizes time-to-interactive frames over architectural generality:

- **Justified layout from API data, not image loads.** Every clip ships its
  real `width`/`height`, so Flickr-style justified rows are computed in one
  pass (`src/lib/justifiedLayout.ts`) before a single image decodes. No
  layout shift, no measure-after-load loops.
- **Row virtualization on the window** (`@tanstack/react-virtual`): only
  visible rows (+overscan) exist in the DOM regardless of how many
  thousands of assets are loaded. The page scrolls as one surface, like the
  real product.
- **Selection subscriptions are derived booleans.** Each tile subscribes to
  `selectedIds.includes(myId)` — not the array — so a selection change
  re-renders only tiles whose membership actually flipped, not every
  mounted tile on every rubber-band tick.
- **One `<video>` element, ever.** Hovering a video tile swaps in a single
  preview player (220ms intent delay); every other video tile is a static
  poster + duration badge. 500 videos cost the same as 500 images.
- **Right-sized thumbnails.** Every image URL goes through imgix with the
  tile's actual on-screen dimensions (`w`/`h`/`dpr`-aware, `auto=format`),
  so the network/decode cost matches what's rendered, not the original
  asset size.
- **Hover states are pure CSS** (`group-hover`) — pointer movement across
  the wall triggers zero React renders.

## UX judgment calls

- **Drag vs. select:** tiles cover ~95% of the wall, so rubber-banding only
  from gaps is fiddly. Plain drag on a tile moves the asset (like Air);
  **Shift+drag lassoes from anywhere**, including starting on a tile. This
  is implemented by gating both libraries symmetrically: a shift-aware
  dnd-kit sensor, and flipping the pressed tile's `data-draggable` flag for
  the duration of the gesture (one DOM write, no re-render).
- **Mutations are local.** The provided API is read-only — there's no write
  endpoint — so reorder/move state lives in a Zustand store persisted to
  `localStorage`. Your arrangement survives refresh; the "server truth"
  seeds any board you haven't touched.
- **Responsive to 320px**: board cards collapse to a 2-up grid, the wall
  re-packs via ResizeObserver, and the selection bar compresses (the "from
  board" clause drops out on small screens).

## Fixed along the way

Two real bugs in the starter, worth flagging:

- `Board.pos` is typed `number` but the API returns a fractional-index
  **string** (e.g. `"01250653445071495.2"`). Typed correctly and compared
  with `Number()` for sorting.
- The starter's TypeScript 5.3 pin silently degrades `@tanstack/react-query`
  v5 inference to `any` (its published types need a newer TS). Upgraded to
  TS 5.6 — which surfaced the real type errors it had been hiding.

## Stack

Next.js 14 (starter) · TypeScript · Tailwind · React Query · Zustand ·
dnd-kit · @tanstack/react-virtual · react-drag-to-select · Radix UI
