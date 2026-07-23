import { useEffect, useMemo } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { fetchAssets, type ClipsListResponse, type SortField } from "@/app/api/clips";
import { useGalleryStore } from "@/lib/store";

export interface AssetQueryOptions {
  search?: string;
  sortField?: SortField;
  includeDescendants?: boolean;
  /**
   * Custom mode = the user's manual order (seeded from the server, then
   * locally rearranged). Server modes (search / explicit sort) render the
   * server's order directly and never write into the local order store.
   */
  serverMode?: boolean;
  /** ISR-provided first page (see app/page.tsx) — paints without a fetch. */
  initialData?: ClipsListResponse;
}

export function useBoardAssets(
  boardId: string,
  enabled: boolean,
  opts: AssetQueryOptions = {}
) {
  const { search, sortField, includeDescendants, serverMode = false, initialData } = opts;

  const query = useInfiniteQuery({
    initialData: initialData
      ? { pages: [initialData], pageParams: [null] }
      : undefined,
    queryKey: [
      "assets",
      boardId,
      search ?? "",
      sortField?.name ?? "dateModified",
      sortField?.direction ?? "desc",
      includeDescendants ?? false,
    ],
    queryFn: ({ pageParam }) =>
      fetchAssets({ boardId, cursor: pageParam, search, sortField, includeDescendants }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasMore ? lastPage.pagination.cursor : undefined,
    enabled,
    staleTime: 60_000,
  });

  const upsertAssets = useGalleryStore((s) => s.upsertAssets);
  const ensureOrder = useGalleryStore((s) => s.ensureOrder);

  const clips = useMemo(
    () => query.data?.pages.flatMap((p) => p.data.clips) ?? [],
    [query.data]
  );
  const total = query.data?.pages[0]?.data.total ?? 0;

  useEffect(() => {
    if (!clips.length) return;
    upsertAssets(clips);
    if (!serverMode) {
      ensureOrder(boardId, clips.map((c) => c.id));
    }
  }, [clips, boardId, serverMode, upsertAssets, ensureOrder]);

  return {
    ...query,
    clips,
    total,
    loadedCount: clips.length,
  };
}
