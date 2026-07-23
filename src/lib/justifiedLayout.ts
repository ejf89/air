export interface JustifiedInput {
  id: string;
  width: number;
  height: number;
}

export interface JustifiedTile extends JustifiedInput {
  displayWidth: number;
  displayHeight: number;
}

export interface JustifiedRow {
  key: string;
  height: number;
  tiles: JustifiedTile[];
}

const MIN_ASPECT = 0.4;
const MAX_ASPECT = 2.6;

/**
 * Greedy Flickr-style justified-row packing. Rows are computed from real
 * width/height (no image loads needed), so layout is stable before any
 * media has decoded.
 */
export function computeJustifiedRows(
  items: JustifiedInput[],
  containerWidth: number,
  targetRowHeight: number,
  gap: number,
  maxRowHeightMultiplier = 1.7
): JustifiedRow[] {
  if (containerWidth <= 0 || !items.length) return [];

  const rows: JustifiedRow[] = [];
  let row: (JustifiedInput & { aspect: number })[] = [];
  let aspectSum = 0;

  const flush = (isLastRow: boolean) => {
    if (!row.length) return;
    const totalGap = gap * (row.length - 1);
    let rowHeight = (containerWidth - totalGap) / aspectSum;

    if (isLastRow) {
      // Don't stretch a sparse trailing row to fill the full width.
      rowHeight = Math.min(rowHeight, targetRowHeight);
    }
    rowHeight = Math.min(rowHeight, targetRowHeight * maxRowHeightMultiplier);

    rows.push({
      key: row.map((t) => t.id).join("-"),
      height: rowHeight,
      tiles: row.map((t) => ({
        id: t.id,
        width: t.width,
        height: t.height,
        displayWidth: rowHeight * t.aspect,
        displayHeight: rowHeight,
      })),
    });
    row = [];
    aspectSum = 0;
  };

  for (const item of items) {
    const rawAspect = item.width && item.height ? item.width / item.height : 1;
    const aspect = Math.min(MAX_ASPECT, Math.max(MIN_ASPECT, rawAspect));
    row.push({ ...item, aspect });
    aspectSum += aspect;

    const widthAtTarget = aspectSum * targetRowHeight + gap * (row.length - 1);
    if (widthAtTarget >= containerWidth) flush(false);
  }
  flush(true);

  return rows;
}
