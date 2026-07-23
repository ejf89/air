# Air Gallery Challenge

A performance-first rebuild of Air's gallery view: board cards + an
interlocking, virtualized wall of images and videos, with drag-and-drop,
rubber-band selection, and Air-style menus.

**Live:** https://air-gallery-six.vercel.app · **Reference:** [public board](https://app.air.inc/a/bDkBvnzpB/b/c74bbbc8-602b-4c88-be71-9e21b36b0514)

## Running locally

```bash
npm i
npm run dev
# open http://localhost:3000
```

## What's built

- **Boards + Assets in collapsible sections**, matching the reference
  gallery: Air-style board cards (thumbnail, gradient, white title) and a
  justified asset wall. Clicking a board navigates into it — the same
  gallery view scoped to that board, with breadcrumbs and a back button
  derived from the API's ancestor chain (carried through the URL for leaf
  boards, which the API can't report ancestors for).
- **Infinite scroll** via cursor pagination — the virtualizer prefetches the
  next page as you approach the end of what's loaded.
- **Drag to reorder** assets within the wall (dnd-kit, 8px activation so
  clicks and drags never fight).
- **Drag to move** assets onto a board card — works for multi-selections
  too: drag any selected tile and the whole selection moves, with a count
  badge on the drag preview.
- **Rubber-band selection** (`react-drag-to-select`) starting anywhere on
  the page — header, margins, or on tiles. Only a selected tile drags;
  everything else lassoes (Air's own model). Shift+drag adds to the
  selection, shift+click range-selects, cmd/ctrl+click toggles, Esc clears.
- **Ellipsis + right-click menus** on every asset and board (Radix), with
  the same actions as the reference site (Open, Share a link, Download —
  downloads are blob-based since cross-origin `<a download>` is ignored).
  When a multi-selection is active the menu reflects the selection count
  and acts on all selected items.
- **Air-style selection bar** pinned to the bottom: ✕, "N items selected
  from …", overflow menu, and Download all.
- **Server-backed search and sort** — debounced search runs across the
  current board's whole subtree (flat results view, like the reference's
  `?q=` mode); sort fields verified against the live API (date modified /
  created / taken, name, size). "Custom" sort is your manual order and the
  only mode where reordering applies — exactly like Air.
- **Video hover previews** — hover a video tile briefly and a real preview
  fades in over the poster (no black loading flash).
- **Hover info overlay** on tiles: name, `EXT · size · W × H`.
- **FLIP layout animation** — after a reorder or move, surviving tiles
  glide to their new packed positions instead of jumping.
- **Move feedback** — a toast confirms every move ("Moved 3 assets to
  Merch"), and board cards light up as drop targets.

## Performance notes (the interesting part)

The brief says 500+ assets under 6x CPU throttle, so every decision below
optimizes time-to-interactive frames over architectural generality:

- **ISR-seeded first paint.** The first page of boards + assets is fetched
  server-side and baked into the HTML, so the LCP image is discovered
  immediately after hydration instead of behind a client API round-trip.
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

- **Drag vs. select:** tiles cover ~95% of the wall, so "lasso only from
  gaps" is unusable. We use Air's model: drag anywhere = rubber band, and
  only an already-selected tile drags assets. Implemented by gating both
  libraries symmetrically — the tile's `data-draggable` attribute mirrors
  its selection state (react-drag-to-select side) and a custom dnd-kit
  sensor checks the same state at pointerdown (drag side).
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
- `react-drag-to-select` (prescribed by the brief) pins `react@^16` peers
  and silently depends on `lodash.throttle` — `.npmrc` legacy-peer-deps and
  an explicit dependency fix both.

## Stack

Next.js 14 (starter) · TypeScript · Tailwind · React Query · Zustand ·
dnd-kit · @tanstack/react-virtual · react-drag-to-select · Radix UI
