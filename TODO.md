# Air Gallery Challenge — Plan & Progress

2-hour timed challenge. Priority order below; if time runs out, everything
below the cut line gets documented as "not done" rather than half-built.

## Confirmed from the real API (not guesses)

- Boards are a real recursive tree (root → children → grandchildren, verified
  via curl against `api.air.inc`). Each board is its own collapsible section.
- Assets are scoped **per board**, not global — root has 761, sub-boards have
  their own small counts (0, 1, 7, ...). Each section lazily fetches its own
  assets on expand via `fetchAssets({ boardId, cursor })`.
- No mutation endpoint exists anywhere in the given API. Reorder / move /
  delete / rename are necessarily **local-only optimistic state** (in-memory +
  localStorage), not real persistence. This is a hard constraint, not a choice.
- Clip records include real `width`/`height`, so a justified/masonry layout
  can be computed without waiting for image loads.
- ~15% of assets are `type: "video"` with a poster `image` + lightweight
  `previewVideo` mp4.

## Architecture decisions

- Recursive collapsible board-section tree; each section owns its own asset
  fetch/pagination state.
- Justified-row masonry grid (real aspect ratios, packed into target-height
  rows), virtualized by row via `@tanstack/react-virtual` — keeps 500+ item
  performance while matching the "interlocking wall" look.
- Mutation state (order, board membership, selection) lives in a single
  client-side store (React context + reducer), persisted to localStorage.
  Small non-blocking affordance indicates it's local/demo-only.
- Video hover preview: at most one `<video>` mounted at a time (whichever
  tile is hovered), not one per tile — avoids decode overhead at scale.
- dnd-kit for reorder + drag-into-board; react-drag-to-select for rubber-band
  multi-select (per the challenge's explicit mention of that package);
  Radix primitives for ellipsis dropdown + right-click context menu, sharing
  one selection-aware menu-items definition.

## Checklist

### Setup
- [x] Flatten starter repo into git root
- [x] Install base deps
- [ ] Install additional packages (react-query, react-virtual, dnd-kit,
      react-drag-to-select, radix context/dropdown menu)
- [ ] Base layout shell + Tailwind pass matching Air's look

### Data layer
- [ ] Parameterize `fetchAssets` by `boardId` (starter hardcodes root board)
- [ ] React Query setup: boards query (recursive per section), assets
      infinite query (cursor pagination) per board
- [ ] Loading / empty / error states per section

### Core gallery
- [ ] Collapsible recursive board sections
- [ ] Justified masonry grid, virtualized by row
- [ ] Infinite scroll within a section

### Interactions
- [ ] Drag-to-reorder assets within a board
- [ ] Drag-to-move assets into a sub-board (drop target = board section)
- [ ] Rubber-band multi-select (react-drag-to-select)
- [ ] Ellipsis hover menu (board + asset), selection-count aware
- [ ] Right-click context menu (board + asset), selection-count aware

### Polish
- [ ] Match/improve visual design
- [ ] Responsive down to 320px
- [ ] Video hover preview (single active slot)

### Ship
- [ ] README: what was built, assumptions, bonus notes
- [ ] Push to `git@github.com:ejf89/air.git`
- [ ] Deploy to Vercel, verify live link end-to-end

## Bonus ideas (only if time remains)

- Lightbox / detail view on click
- Keyboard nav (arrow keys, shift-select, cmd/ctrl-select, delete key)
- Command palette or quick search/filter across assets
- Drag-select + drag-move combined (grab a multi-selection and drag as a
  group into a board)
