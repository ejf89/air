/**
 * Shared registry of mounted tile elements, keyed by asset id. The page-level
 * rubber-band selection (Gallery.tsx) intersects the drag box against these
 * rects; grids register/unregister tiles as virtualization mounts them.
 */
export const tileRegistry = new Map<string, HTMLElement>();
