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
- [x] Install additional packages (react-query, react-virtual, dnd-kit,
      react-drag-to-select, radix context/dropdown menu, zustand)
- [x] Fix starter bugs found in adversarial pass: `Board.pos` typed as
      number but is a numeric string; TS 5.3.3 too old for react-query v5
      types (silently degraded `data` to `any`) — upgraded to TS 5.6

### Data layer
- [x] Parameterize `fetchAssets` by `boardId` (starter hardcodes root board)
- [x] React Query: board tree query (BFS, parallel per level), assets
      infinite query (cursor pagination) per board
- [x] Loading / empty states per grid

### Core gallery (restructured to match reference site)
- [x] "Boards" collapsible section with Air-style board cards
      (thumbnail + gradient + white title)
- [x] "Assets" collapsible section: justified wall from real API
      width/height, window-scroll virtualization by row
- [x] Infinite scroll (cursor pagination + virtualizer-driven prefetch)
- [x] Board card click → inline expandable panel with that board's assets
- [x] Fixed: measurement container must always mount (early-return skeleton
      branch left containerWidth at 0 → blank wall)

### Interactions
- [x] Drag-to-reorder assets within a board (dnd-kit, 8px activation)
- [x] Drag-to-move assets into a sub-board (drop on board card, works
      with multi-selection + count badge on drag overlay)
- [x] Rubber-band multi-select (react-drag-to-select)
- [x] Shift+click range select, cmd/ctrl+click toggle, Esc clears
- [x] Ellipsis hover menu matching demo exactly (Open, Share a link,
      Copy to Air workspace, Download) — count-aware when multi-selected
- [x] Right-click context menu (same items), boards too
- [x] Bottom "N selected" floating bar (Download / Move to / Clear)

### Polish
- [x] Match visual design (verified via headless Chrome screenshots)
- [ ] Responsive down to 320px — needs verification pass
- [x] Video hover preview (single active `<video>` slot app-wide)
- [ ] In-browser interaction verification (drag, select, menus) — USER TEST
- [ ] Perf pass: 500+ assets with 6x CPU throttle

### Ship
- [ ] README: what was built, assumptions, bonus notes
- [ ] Push to `git@github.com:ejf89/air.git`
- [ ] Deploy to Vercel, verify live link end-to-end

## Bonus ideas (only if time remains)

- **Onboarding walkthrough (user's pick — prioritize first)**: first-visit
  tour that spotlights the gallery's hidden interactions in sequence
  (rubber-band select → shift+lasso → drag to reorder → drop on a board →
  hover video preview → context menu). Dismissable, persisted in
  localStorage so it only shows once, restartable from a "?" button.

- Lightbox / detail view on click
- Keyboard nav (arrow keys, shift-select, cmd/ctrl-select, delete key)
- Command palette or quick search/filter across assets
- Drag-select + drag-move combined (grab a multi-selection and drag as a
  group into a board)
