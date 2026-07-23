export interface Board {
  id: string;
  parentId: string | null;
  creatorId: string;
  workspaceId: string;
  title: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  hasCurrentUser: boolean;
  thumbnails?: string[];
  ancestors?: Pick<Board, "id" | "title">[];
  // Numeric-looking string (fractional sort index), not a number — e.g.
  // "01250653445071495.2000000". Verified against the live API; the
  // original starter typed this as `number`, which is wrong. Compare with
  // `Number(a.pos) - Number(b.pos)`, don't call number methods on it.
  pos: string;
}

export interface BoardsListResponse {
  data: Board[];
  pagination: {
    hasMore: boolean;
    cursor: string | null;
  };
  total: number;
}

export const ROOT_BOARD_ID = "c74bbbc8-602b-4c88-be71-9e21b36b0514";
export const SHORT_ID = "bDkBvnzpB";

export const fetchBoards = (
  boardId: string = ROOT_BOARD_ID
): Promise<BoardsListResponse> =>
  fetch(`https://api.air.inc/shorturl/${SHORT_ID}/boards/${boardId}`, {
    method: "post",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      ancestorCutoff: ROOT_BOARD_ID,
      numThumbnails: 1,
      view: boardId,
      includeAncestors: true,
      libraryBoards: "ALL",
      limit: 30,
      cursor: null,
      sortBy: "custom",
      sortField: {
        direction: "desc",
        name: "dateModified",
      },
    }),
  }).then((r) => r.json());

/**
 * The board tree here is small (a handful of boards deep), unlike asset
 * counts which can run into the hundreds per board. We fetch it eagerly,
 * one BFS level at a time (parallel within a level), so the full collapsible
 * tree and the "move to board" menu both have a complete board list up
 * front, while each board's own (potentially large) asset list still loads
 * lazily on expand.
 */
export async function fetchBoardTree(): Promise<Board[]> {
  const all: Board[] = [];
  let frontier = [ROOT_BOARD_ID];
  const seen = new Set<string>(frontier);

  while (frontier.length) {
    const results = await Promise.all(frontier.map((id) => fetchBoards(id)));
    const next: string[] = [];
    for (const res of results) {
      for (const board of res.data) {
        if (seen.has(board.id)) continue;
        seen.add(board.id);
        all.push(board);
        next.push(board.id);
      }
    }
    frontier = next;
  }

  return all;
}
